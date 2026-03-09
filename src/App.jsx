import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@supabase/supabase-js";

// ---Supabase 클라이언트---
const supabase = createClient(
  "https://qbvgpnippasdyxxjbbwt.supabase.co",
  "sb_publishable_4JKZv64CCbjKTN2ZmiHR9A_CKdPBLFd"
);

// ---Supabase DB 헬퍼---
const DB = {
  // 유저 조회 or 생성 (upsert)
  async upsertUser(tossUserKey) {
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("users")
        .upsert({ toss_user_key: tossUserKey, last_visit_date: today }, { onConflict: "toss_user_key" })
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn("[DB] upsertUser 실패:", e);
      return null;
    }
  },

  // 유저 데이터 불러오기
  async getUser(tossUserKey) {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("toss_user_key", tossUserKey)
        .single();
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn("[DB] getUser 실패:", e);
      return null;
    }
  },

  // 포인트 + streak 업데이트
  async updateUser(tossUserKey, { points, streak, lastVisitDate }) {
    try {
      const { error } = await supabase
        .from("users")
        .update({ points, streak, last_visit_date: lastVisitDate })
        .eq("toss_user_key", tossUserKey);
      if (error) throw error;
    } catch (e) {
      console.warn("[DB] updateUser 실패:", e);
    }
  },

  // 오늘 완료한 퀘스트 목록 조회
  async getTodayCompletions(tossUserKey) {
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("toss_user_key", tossUserKey)
        .single();
      if (!user) return [];
      const { data, error } = await supabase
        .from("quest_completions")
        .select("quest_id")
        .eq("user_id", user.id)
        .eq("completed_date", today);
      if (error) throw error;
      return data.map((d) => d.quest_id);
    } catch (e) {
      console.warn("[DB] getTodayCompletions 실패:", e);
      return [];
    }
  },

  // 퀘스트 완료 기록 저장
  async saveCompletion(tossUserKey, quest) {
    try {
      const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("toss_user_key", tossUserKey)
        .single();
      if (!user) return;
      const { error } = await supabase.from("quest_completions").insert({
        user_id: user.id,
        quest_id: quest.id,
        quest_title: quest.title,
        points_earned: quest.points,
      });
      if (error) throw error;
    } catch (e) {
      console.warn("[DB] saveCompletion 실패:", e);
    }
  },

  // 랭킹 TOP 10 조회
  async getLeaderboard() {
    try {
      const { data, error } = await supabase
        .from("leaderboard")
        .select("*")
        .limit(10);
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn("[DB] getLeaderboard 실패:", e);
      return [];
    }
  },
};


// ---앱인토스 SDK 래퍼---
// 토스 앱 내에서는 실제 SDK 동작, 일반 브라우저에서는 fallback 처리
const TossSDK = {
  // SDK 사용 가능 여부 체크
  isAvailable() {
    return typeof window !== "undefined" && window.__APPS_IN_TOSS__ != null;
  },

  // 토스 로그인 → authorizationCode + referrer 반환
  async appLogin() {
    try {
      if (!this.isAvailable()) {
        console.log("[TossSDK] 브라우저 환경 — appLogin fallback");
        return { authorizationCode: null, referrer: "browser" };
      }
      const { appLogin } = await import("@apps-in-toss/web-framework");
      return await appLogin();
    } catch (e) {
      console.warn("[TossSDK] appLogin 실패:", e);
      return { authorizationCode: null, referrer: "error" };
    }
  },

  // 게임용 유저 고유 키 획득
  async getUserKey() {
    try {
      if (!this.isAvailable()) {
        console.log("[TossSDK] 브라우저 환경 — getUserKey fallback");
        return null;
      }
      const { getUserKeyForGame } = await import("@apps-in-toss/web-framework");
      return await getUserKeyForGame();
    } catch (e) {
      console.warn("[TossSDK] getUserKey 실패:", e);
      return null;
    }
  },

  // 화면 방향 고정 (portrait = 세로)
  async setOrientation(orientation = "portrait") {
    try {
      if (!this.isAvailable()) return;
      const { setDeviceOrientation } = await import("@apps-in-toss/web-framework");
      await setDeviceOrientation(orientation);
    } catch (e) {
      console.warn("[TossSDK] setOrientation 실패:", e);
    }
  },

  // 이벤트 트래킹
  async trackEvent(eventName, params = {}) {
    try {
      if (!this.isAvailable()) {
        console.log(`[TossSDK] Analytics fallback — ${eventName}`, params);
        return;
      }
      const { Analytics } = await import("@apps-in-toss/web-framework");
      Analytics.track(eventName, params);
    } catch (e) {
      console.warn("[TossSDK] trackEvent 실패:", e);
    }
  },
};


// ---타이머 안내 문구---
const TIMER_HINTS = {
  1: ["코로 천천히 들이마시고... 🌬️","4초 동안 숨을 채워요...","입으로 길게 내뱉으세요... 😮‍💨","스트레스가 빠져나가는 중..."],
  2: ["혀를 천장에 꾹 밀착! 👅","턱을 살짝 당기고 유지...","그대로! 페이스 리프팅 중...","거의 다 왔어요, 버텨요! 💪"],
  4: ["양손을 허벅지에 올려요 🤲","힘껏! 아래로 눌러요...","등 근육이 수축하는 느낌?","아무도 모르게 운동 중... 💪"],
  5: ["멀리 있는 벽을 바라봐요 👁️","눈의 긴장을 풀어주세요...","깜빡이지 않아도 괜찮아요","망막이 감사하고 있습니다 ✨"],
  6: ["손가락을 깍지 껴요 🤲","손목을 천천히 돌리고...","반대 방향으로도 돌려요","타이피스트 직업병 퇴치 중! ⌨️"],
};
const DEFAULT_HINTS = ["집중! 거의 다 왔어요 💪","그대로 유지하세요...","아무도 모르게 건강해지는 중","10초만 버텨요! ✨"];

// ---퀘스트 데이터---
const QUESTS = [
  { id: 1, emoji: "😮‍💨", title: "10초 한숨", desc: "몰래 스트레스 방출하기", tag: "숨쉬기", tagColor: "bg-blue-50 text-blue-500", points: 10, duration: 10, type: "timer", detail: "지금 이 순간, 눈 감고 코로 4초 들이쉬고 입으로 6초 내뱉어봐요. 아무도 몰라요. 진짜로." },
  { id: 2, emoji: "👅", title: "뮤잉 10초", desc: "혀로 하는 비밀 페이스 리프팅", tag: "얼굴", tagColor: "bg-pink-50 text-pink-500", points: 15, duration: 10, type: "timer", detail: "혀 전체를 천장에 밀착! 10초만 버티면 됩니다. 얼굴 동그래지는 거 막아준대요." },
  { id: 3, emoji: "🦶", title: "까치발 펌핑", desc: "앉아서 종아리 몰래 운동", tag: "하체", tagColor: "bg-green-50 text-green-500", points: 20, duration: 10, type: "sensor", goal: 10, detail: "발뒤꿈치를 들었다 내렸다! 10번만 하면 종아리 근육이 제2의 심장이 됩니다. 심각하게." },
  { id: 4, emoji: "💪", title: "어깨 압박", desc: "책상 아래서 몰래 하는 등 운동", tag: "상체", tagColor: "bg-orange-50 text-orange-500", points: 15, duration: 10, type: "timer", detail: "양손을 허벅지 위에 올리고 힘껏 아래로 눌러요. 등이 알아서 수축합니다. 진짜임." },
  { id: 5, emoji: "👁️", title: "눈 운동", desc: "액정 중독에서 망막 구하기", tag: "눈", tagColor: "bg-purple-50 text-purple-500", points: 10, duration: 10, type: "timer", detail: "멀리 있는 창문이나 벽을 10초간 멍하니 바라봐요. 눈 근육 경직 해소. 안구건조 완화." },
  { id: 6, emoji: "🤲", title: "손목 스트레칭", desc: "타이피스트 직업병 예방", tag: "손목", tagColor: "bg-yellow-50 text-yellow-600", points: 10, duration: 10, type: "timer", detail: "손가락을 깍지 끼고 손목을 천천히 돌려요. 10초면 충분. 코딩 손목을 지킵시다." },
];

const LEVELS = [
  { min: 0,   label: "건강 입문자", emoji: "🐣" },
  { min: 50,  label: "습관 새싹",   emoji: "🌱" },
  { min: 150, label: "헬스 고수",   emoji: "💪" },
  { min: 300, label: "건강 장인",   emoji: "🏆" },
  { min: 500, label: "몸신",        emoji: "⚡" },
];

function getLevel(pts) {
  let lv = LEVELS[0];
  for (const l of LEVELS) { if (pts >= l.min) lv = l; }
  return lv;
}

// ---폭죽 파티클 컴포넌트---
const CONFETTI_COLORS = ["#2563EB","#F59E0B","#10B981","#EF4444","#8B5CF6","#EC4899","#06B6D4"];

function ConfettiParticle({ x, color, delay }) {
  return (
    <motion.div
      className="fixed pointer-events-none z-[100]"
      style={{ left: `${x}%`, top: "-10px", width: 8, height: 8, borderRadius: 2, backgroundColor: color }}
      initial={{ y: 0, opacity: 1, rotate: 0, scale: 1 }}
      animate={{ y: typeof window !== "undefined" ? window.innerHeight + 50 : 800, opacity: [1, 1, 0], rotate: 720, scale: [1, 1.2, 0.8] }}
      transition={{ duration: 2.2 + Math.random() * 0.8, delay, ease: "easeIn" }}
    />
  );
}

function Confetti({ show }) {
  const particles = useRef(
    Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: Math.random() * 0.6,
    }))
  );
  if (!show) return null;
  return (
    <>
      {particles.current.map((p) => (
        <ConfettiParticle key={p.id} x={p.x} color={p.color} delay={p.delay} />
      ))}
    </>
  );
}

// ---레벨업 오버레이---
// ---LeaderboardModal---
function LeaderboardModal({ data, myKey, onClose }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-white max-w-md mx-auto"
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4 border-b border-gray-100">
        <h2 className="text-lg font-bold text-gray-900">🏆 포인트 랭킹</h2>
        <button onClick={onClose} className="text-gray-400 text-2xl leading-none active:opacity-50">✕</button>
      </div>

      {/* 리스트 */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {data.length === 0 ? (
          <div className="text-center text-gray-400 py-20">
            <p className="text-4xl mb-3">🌱</p>
            <p className="text-sm">아직 데이터가 없어요<br />퀘스트를 완료하면 여기에 표시돼요!</p>
          </div>
        ) : data.map((row, i) => {
          const isMe = row.toss_user_key === myKey;
          const medals = ["🥇", "🥈", "🥉"];
          const rankIcon = i < 3 ? medals[i] : `${i + 1}위`;
          return (
            <motion.div
              key={row.toss_user_key}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`flex items-center gap-3 p-4 rounded-2xl ${isMe ? "bg-blue-50 border-2 border-blue-200" : "bg-gray-50"}`}
            >
              <span className="text-xl w-8 text-center">{rankIcon}</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">
                  {isMe ? "나 👈" : `유저 ${String(row.toss_user_key).slice(-4)}`}
                </p>
                <p className="text-xs text-gray-400">🔥 {row.streak || 0}일 연속</p>
              </div>
              <span className="text-blue-600 font-bold text-sm">{(row.points || 0).toLocaleString()}P</span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

function LevelUpOverlay({ level, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="bg-white rounded-3xl px-10 py-8 shadow-2xl flex flex-col items-center gap-3"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <motion.span
          className="text-6xl"
          animate={{ rotate: [0, -15, 15, -10, 10, 0], scale: [1, 1.3, 1] }}
          transition={{ duration: 0.8 }}
        >
          {level.emoji}
        </motion.span>
        <p className="text-xs font-bold text-blue-500 uppercase tracking-widest">레벨 업!</p>
        <p className="text-2xl font-black text-gray-900">{level.label}</p>
        <p className="text-sm text-gray-400">달성을 축하해요 🎉</p>
      </motion.div>
    </motion.div>
  );
}

// ---포인트 획득 토스트---
function PointToast({ points, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      className="fixed top-20 left-1/2 -translate-x-1/2 z-[95] pointer-events-none"
      initial={{ opacity: 0, y: -20, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -30, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
    >
      <div className="bg-blue-600 text-white font-black text-xl px-6 py-3 rounded-2xl shadow-lg">
        +{points}P 🎉
      </div>
    </motion.div>
  );
}

// ---useTimer 훅---
function useTimer(duration) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const intervalRef = useRef(null);
  const start = () => { if (running || done) return; setRunning(true); };
  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(intervalRef.current); setRunning(false); setDone(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running]);
  return { timeLeft, running, done, start };
}

// ---useSensor 훅---
function useSensor({ goal = 10, threshold = 1.5, cooldown = 600 }) {
  const [permission, setPermission] = useState("idle");
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);
  const [bump, setBump] = useState(0);
  const lastTriggerRef = useRef(0);
  const peakRef = useRef(false);

  const requestPermission = useCallback(async () => {
    setPermission("requesting");
    try {
      if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
        let result = "denied";
        try { result = await DeviceMotionEvent.requestPermission(); }
        catch { result = "granted"; }
        setPermission(result === "granted" ? "granted" : "denied");
      } else {
        setPermission("granted");
      }
    } catch { setPermission("denied"); }
  }, []);

  useEffect(() => {
    if (permission !== "granted" || done) return;
    const handleMotion = (e) => {
      const accel = e.accelerationIncludingGravity;
      if (!accel) return;
      const val = Math.max(Math.abs(accel.x ?? 0), Math.abs(accel.y ?? 0), Math.abs(accel.z ?? 0));
      const now = Date.now();
      if (val > 10 + threshold && !peakRef.current) peakRef.current = true;
      if (val < 10 + threshold * 0.3 && peakRef.current) {
        peakRef.current = false;
        if (now - lastTriggerRef.current > cooldown) {
          lastTriggerRef.current = now;
          if (typeof window.navigator.vibrate === "function") window.navigator.vibrate(50);
          setCount((prev) => {
            const next = prev + 1;
            setBump((b) => b + 1);
            if (next >= goal) setDone(true);
            return next;
          });
        }
      }
    };
    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, [permission, done, goal, threshold, cooldown]);

  return { permission, count, done, bump, requestPermission };
}

// ---CircleProgress---
function CircleProgress({ progress, size = 180, strokeWidth = 10, children }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#E5E7EB" strokeWidth={strokeWidth} />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#2563EB" strokeWidth={strokeWidth}
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

// ---Header---
function Header({ points, completed, streak, lastVisit, onLeaderboard }) {
  const lv = getLevel(points);
  const nextLv = LEVELS.find((l) => l.min > points);
  const curMin = getLevel(points).min;
  const progress = nextLv ? ((points - curMin) / (nextLv.min - curMin)) * 100 : 100;
  const lastVisitText = lastVisit
    ? lastVisit === getDateStr() ? "오늘 방문" : `마지막 방문: ${lastVisit.replace(/_/g, ".")}`
    : "첫 방문 🎉";
  return (
    <div className="bg-white px-5 pt-12 pb-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-medium text-gray-400 mb-0.5">오늘의 건강 현황</p>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{lv.emoji}</span>
            <span className="text-lg font-bold text-gray-900">{lv.label}</span>
          </div>
        </div>
        <div className="text-right">
          <button onClick={onLeaderboard} className="flex flex-col items-end active:opacity-70">
            <p className="text-xs text-gray-400 mb-0.5">모은 포인트</p>
            <p className="text-2xl font-bold text-blue-600">{points.toLocaleString()}P</p>
          </button>
        </div>
      </div>
      <div className="mb-2">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>다음 레벨까지</span>
          {nextLv ? <span>{nextLv.min - points}P 남음</span> : <span>최고 레벨 달성! 🎉</span>}
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div className="bg-blue-500 h-2 rounded-full transition-all duration-700" style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
        <div className="bg-blue-50 text-blue-600 text-xs font-semibold px-2.5 py-1 rounded-full">
          오늘 {completed}/{QUESTS.length} 완료
        </div>
        <motion.div
          className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${streak > 0 ? "bg-orange-50 text-orange-500" : "bg-gray-100 text-gray-400"}`}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          🔥 {streak > 0 ? `${streak}일째 건강 중` : "오늘부터 시작!"}
        </motion.div>
        {completed === QUESTS.length && (
          <div className="bg-yellow-50 text-yellow-600 text-xs font-semibold px-2.5 py-1 rounded-full animate-pulse">🎊 모두 완료!</div>
        )}
      </div>
      <p className="text-xs text-gray-300 mt-2">{lastVisitText}</p>
    </div>
  );
}

// ---QuestCard---
function QuestCard({ quest, isDone, onClick }) {
  return (
    <button onClick={onClick}
      className={`w-full text-left bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4 active:scale-95 transition-transform duration-150 ${isDone ? "opacity-50" : ""}`}
    >
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${isDone ? "bg-gray-100" : "bg-blue-50"}`}>
        {isDone ? "✅" : quest.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-bold text-gray-900 text-sm">{quest.title}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${quest.tagColor}`}>{quest.tag}</span>
        </div>
        <p className="text-xs text-gray-500 truncate">{quest.desc}</p>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className={`text-sm font-bold ${isDone ? "text-gray-400" : "text-blue-600"}`}>+{quest.points}P</p>
        {!isDone && <p className="text-gray-300 text-xs">▶</p>}
      </div>
    </button>
  );
}

// ---QuestList---
function QuestList({ completedIds, onSelect }) {
  const pending = QUESTS.filter((q) => !completedIds.includes(q.id));
  const done = QUESTS.filter((q) => completedIds.includes(q.id));
  return (
    <div className="px-4 py-5 space-y-3">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">오늘의 미션 · {pending.length}개 남음</p>
      {pending.map((q) => <QuestCard key={q.id} quest={q} isDone={false} onClick={() => onSelect(q)} />)}
      {done.length > 0 && (
        <>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1 pt-2">완료한 미션 · {done.length}개</p>
          {done.map((q) => <QuestCard key={q.id} quest={q} isDone={true} onClick={() => {}} />)}
        </>
      )}
    </div>
  );
}

// ---TimerView---
function TimerView({ quest, onComplete }) {
  const { timeLeft, running, done, start } = useTimer(quest.duration);
  const hints = TIMER_HINTS[quest.id] || DEFAULT_HINTS;
  const [hintIdx, setHintIdx] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setHintIdx((prev) => (prev + 1) % hints.length), 2500);
    return () => clearInterval(id);
  }, [running, hints.length]);
  const progress = (quest.duration - timeLeft) / quest.duration;
  return (
    <div className="flex flex-col items-center py-2">
      <CircleProgress progress={progress}>
        <div className="flex flex-col items-center gap-1">
          <motion.span className="text-5xl select-none"
            animate={running ? { scale: [1, 1.18, 1] } : { scale: 1 }}
            transition={running ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" } : {}}>
            {done ? "✅" : quest.emoji}
          </motion.span>
          {!done && <span className="text-3xl font-bold text-gray-900 tabular-nums leading-none">{timeLeft}</span>}
        </div>
      </CircleProgress>
      <div className="mt-5 mb-5 h-6 flex items-center justify-center w-full">
        <AnimatePresence mode="wait">
          {running && (
            <motion.p key={hintIdx} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35 }}
              className="text-sm text-gray-500 text-center">{hints[hintIdx]}</motion.p>
          )}
          {!running && !done && (
            <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-gray-400 text-center">버튼을 눌러 10초 타이머를 시작하세요</motion.p>
          )}
          {done && (
            <motion.p key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-base font-bold text-blue-600 text-center">🎉 완료! 수고했어요!</motion.p>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence mode="wait">
        {done ? (
          <motion.button key="claim" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            onClick={onComplete} className="w-full bg-blue-600 text-white font-bold text-base py-4 rounded-2xl">
            🏆 완료! +{quest.points}P 받기
          </motion.button>
        ) : (
          <motion.button key="start" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            onClick={start} disabled={running}
            className={`w-full font-bold text-base py-4 rounded-2xl transition-colors ${running ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-blue-600 text-white active:bg-blue-700"}`}>
            {running ? `⏱ 집중 중... ${timeLeft}초` : "지금 바로 시작하기 →"}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---SensorView---
function SensorView({ quest, onComplete }) {
  const goal = quest.goal ?? 10;
  const { permission, count, done, bump, requestPermission } = useSensor({ goal });
  const progress = count / goal;
  const bumpKey = bump;
  return (
    <div className="flex flex-col items-center py-2">
      {permission === "idle" && (
        <div className="w-full flex flex-col items-center gap-5 py-4">
          <div className="w-20 h-20 bg-green-50 rounded-3xl flex items-center justify-center text-4xl">🦶</div>
          <div className="bg-gray-50 rounded-2xl p-4 w-full">
            <p className="text-sm text-gray-600 leading-relaxed text-center">까치발 감지를 위해<br />스마트폰 모션 센서 접근이 필요해요.</p>
          </div>
          <button onClick={requestPermission} className="w-full bg-blue-600 text-white font-bold text-base py-4 rounded-2xl active:bg-blue-700 transition-colors">
            📡 센서 권한 허용하기
          </button>
        </div>
      )}
      {permission === "requesting" && (
        <div className="w-full flex flex-col items-center gap-4 py-8">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full" />
          <p className="text-sm text-gray-500">권한 요청 중...</p>
        </div>
      )}
      {permission === "denied" && (
        <div className="w-full flex flex-col items-center gap-4 py-6">
          <div className="text-4xl">😢</div>
          <p className="text-sm text-gray-500 text-center">센서 권한이 거부됐어요.<br />기기 설정에서 허용 후 다시 시도해 주세요.</p>
          <button onClick={requestPermission} className="w-full bg-gray-100 text-gray-600 font-bold text-base py-4 rounded-2xl">다시 시도하기</button>
        </div>
      )}
      {permission === "granted" && (
        <>
          <CircleProgress progress={progress} size={180} strokeWidth={10}>
            <div className="flex flex-col items-center gap-0.5">
              <motion.span className="text-4xl select-none"
                animate={!done ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                transition={!done ? { duration: 0.8, repeat: Infinity, ease: "easeInOut" } : {}}>
                {done ? "✅" : "🦶"}
              </motion.span>
              <AnimatePresence mode="wait">
                <motion.span key={bumpKey} initial={{ scale: 1.6, color: "#2563EB" }} animate={{ scale: 1, color: "#111827" }}
                  transition={{ type: "spring", stiffness: 400, damping: 18 }}
                  className="text-4xl font-black tabular-nums leading-none">{count}</motion.span>
              </AnimatePresence>
              <span className="text-xs text-gray-400 font-medium">/ {goal}회</span>
            </div>
          </CircleProgress>
          <div className="mt-5 mb-5 h-6 flex items-center justify-center w-full">
            <AnimatePresence mode="wait">
              {!done ? (
                <motion.p key="guide" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-gray-500 text-center">
                  {count === 0 ? "발뒤꿈치를 들었다 내렸다! 반복하세요 🦵" : `잘하고 있어요! ${goal - count}번만 더!`}
                </motion.p>
              ) : (
                <motion.p key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-base font-bold text-blue-600 text-center">
                  🎉 {goal}회 달성! 종아리 칭찬해!
                </motion.p>
              )}
            </AnimatePresence>
          </div>
          <div className="flex gap-1.5 flex-wrap justify-center mb-6">
            {Array.from({ length: goal }).map((_, i) => (
              <motion.div key={i} initial={{ scale: 0.8 }}
                animate={{ scale: i < count ? 1 : 0.8, backgroundColor: i < count ? "#2563EB" : "#E5E7EB" }}
                transition={{ type: "spring", stiffness: 300 }} className="w-5 h-5 rounded-full" />
            ))}
          </div>
          <AnimatePresence mode="wait">
            {done ? (
              <motion.button key="claim" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                onClick={onComplete} className="w-full bg-blue-600 text-white font-bold text-base py-4 rounded-2xl">
                🏆 성공! +{quest.points}P 받기
              </motion.button>
            ) : (
              <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="w-full bg-gray-100 text-gray-400 font-bold text-base py-4 rounded-2xl text-center">
                {count === 0 ? "까치발을 들면 자동 감지돼요" : `${count}/${goal} 감지 중...`}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

// ---QuestModal---
function QuestModal({ quest, onClose, onComplete, isCompleted }) {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState("info");
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  const handleClose = () => { setVisible(false); setTimeout(onClose, 300); };
// ---날짜 문자열 헬퍼---
function getDateStr(date = new Date()) {
  return `${date.getFullYear()}_${date.getMonth() + 1}_${date.getDate()}`;
}

// ---인트로 화면 (토스 로그인 전 서비스 소개)---
// 비게임 체크리스트 7항: "서비스 소개 없이 곧바로 로그인 유도 불가"
function IntroScreen({ onStart }) {
  return (
    <div className="bg-white min-h-screen max-w-md mx-auto flex flex-col">
      {/* 상단 영역 */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 pt-16 pb-8">
        {/* 앱 아이콘 */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 18 }}
          className="w-24 h-24 bg-blue-600 rounded-3xl flex items-center justify-center mb-8 shadow-lg"
        >
          <span className="text-4xl">⚡</span>
        </motion.div>

        {/* 앱 이름 */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-3xl font-bold text-gray-900 mb-3 text-center"
        >
          10초 건강컷
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="text-gray-500 text-center text-base leading-relaxed mb-12"
        >
          헬스장 없이, 기구 없이<br />
          일상 속 10초로 건강해지는 습관
        </motion.p>

        {/* 서비스 특징 3가지 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="w-full space-y-4 mb-12"
        >
          {[
            { icon: "🎯", title: "매일 6가지 퀘스트", desc: "10초면 끝나는 건강 미션" },
            { icon: "⭐", title: "포인트 & 레벨업", desc: "완료할수록 쌓이는 보상" },
            { icon: "🔥", title: "연속 달성 스트릭", desc: "꾸준함이 만드는 건강 습관" },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-4 bg-gray-50 rounded-2xl p-4">
              <span className="text-2xl">{f.icon}</span>
              <div>
                <div className="font-semibold text-gray-900 text-sm">{f.title}</div>
                <div className="text-gray-500 text-xs mt-0.5">{f.desc}</div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* 하단 CTA */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="px-6 pb-10"
      >
        <button
          onClick={onStart}
          className="w-full bg-blue-600 text-white font-bold text-lg py-4 rounded-2xl active:scale-95 transition-transform"
        >
          토스로 시작하기
        </button>
        <p className="text-center text-gray-400 text-xs mt-4">
          시작하면 서비스 이용약관 및 개인정보처리방침에 동의하게 됩니다
        </p>
      </motion.div>
    </div>
  );
}

// ---App---
export default function App() {
  // ---인트로 화면 상태---
  const [showIntro, setShowIntro] = useState(() => {
    // 이미 로그인한 유저는 인트로 스킵
    try { return !localStorage.getItem("hq_user_key"); }
    catch { return true; }
  });

  // ---토스 SDK + Supabase 유저 상태---
  const [tossUserKey, setTossUserKey] = useState(() => {
    try { return localStorage.getItem("hq_user_key") ?? null; }
    catch { return null; }
  });

  // ---로컬 상태 (Supabase fallback용)---
  const [points, setPoints] = useState(() => {
    try { return parseInt(localStorage.getItem("hq_points") ?? "0", 10); }
    catch { return 0; }
  });
  const [completedIds, setCompletedIds] = useState(() => {
    try {
      const today = getDateStr();
      const saved = localStorage.getItem(`hq_done_${today}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [streak, setStreak] = useState(() => {
    try { return parseInt(localStorage.getItem("hq_streak") ?? "0", 10); }
    catch { return 0; }
  });

  const [selectedQuest, setSelectedQuest] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [pointToast, setPointToast] = useState(null);
  const [levelUp, setLevelUp] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [lastVisit, setLastVisit] = useState(() => {
    try { return localStorage.getItem("hq_last_visit") ?? null; }
    catch { return null; }
  });

  // ---앱 진입 시 세로 방향 고정---
  useEffect(() => {
    TossSDK.setOrientation("portrait");
  }, []);

  // ---날짜 변경 감지---
  useEffect(() => {
    try {
      const today = getDateStr();
      const storedLastVisit = localStorage.getItem("hq_last_visit");
      if (storedLastVisit && storedLastVisit !== today) {
        const last = new Date(storedLastVisit.replace(/_/g, "-"));
        const now = new Date();
        const diffDays = Math.round((now - last) / (1000 * 60 * 60 * 24));
        const lastCompleted = localStorage.getItem(`hq_done_${storedLastVisit}`);
        const lastCompletedIds = lastCompleted ? JSON.parse(lastCompleted) : [];
        const didCompleteYesterday = diffDays === 1 && lastCompletedIds.length > 0;
        const newStreak = didCompleteYesterday ? streak + 1 : 0;
        setStreak(newStreak);
        setCompletedIds([]);
      }
      localStorage.setItem("hq_last_visit", today);
      setLastVisit(today);
    } catch {}
  }, []);

  // ---로컬 저장---
  useEffect(() => { try { localStorage.setItem("hq_points", points); } catch {} }, [points]);
  useEffect(() => {
    try { localStorage.setItem(`hq_done_${getDateStr()}`, JSON.stringify(completedIds)); } catch {}
  }, [completedIds]);
  useEffect(() => { try { localStorage.setItem("hq_streak", streak); } catch {} }, [streak]);

  const handleComplete = async (quest) => {
    if (completedIds.includes(quest.id)) return;

    const prevLevel = getLevel(points);
    const newPoints = points + quest.points;
    const newLevel = getLevel(newPoints);
    const newCompletedIds = [...completedIds, quest.id];
    const today = new Date().toISOString().split("T")[0];

    setCompletedIds(newCompletedIds);
    setPoints(newPoints);

    // Supabase 저장
    if (tossUserKey) {
      const newStreak = newCompletedIds.length === QUESTS.length ? streak + 1 : streak;
      await DB.saveCompletion(tossUserKey, quest);
      await DB.updateUser(tossUserKey, {
        points: newPoints,
        streak: newStreak,
        lastVisitDate: today,
      });
      if (newCompletedIds.length === QUESTS.length) setStreak(newStreak);
    }

    // 이벤트 트래킹
    await TossSDK.trackEvent("quest_complete", {
      questId: quest.id,
      questTitle: quest.title,
      points: quest.points,
      totalPoints: newPoints,
    });

    // 폭죽 + 포인트 토스트
    setShowConfetti(true);
    setPointToast({ points: quest.points });
    setTimeout(() => setShowConfetti(false), 2500);

    // 레벨업 감지
    if (newLevel.min !== prevLevel.min) {
      await TossSDK.trackEvent("level_up", { newLevel: newLevel.label });
      setTimeout(() => setLevelUp({ level: newLevel }), 600);
    }
  };

  // ---인트로 화면 표시---
  if (showIntro) {
    return (
      <IntroScreen onStart={async () => {
        setShowIntro(false);
        // 토스 로그인 시작
        await TossSDK.appLogin();
        const userKey = await TossSDK.getUserKey();
        if (userKey) {
          setTossUserKey(userKey);
          try { localStorage.setItem("hq_user_key", userKey); } catch {}
          const dbUser = await DB.getUser(userKey);
          if (dbUser) {
            setPoints(dbUser.points);
            setStreak(dbUser.streak);
            const todayCompletions = await DB.getTodayCompletions(userKey);
            setCompletedIds(todayCompletions);
          } else {
            await DB.upsertUser(userKey);
          }
        }
        await TossSDK.trackEvent("health_quest_open", { hasUserKey: !!userKey });
      }} />
    );
  }

  // ---리더보드 열기---
  const handleLeaderboard = async () => {
    const data = await DB.getLeaderboard();
    setLeaderboardData(data || []);
    setShowLeaderboard(true);
  };

  return (
    <div className="bg-gray-50 min-h-screen max-w-md mx-auto relative overflow-x-hidden">
      <Header
        points={points}
        completed={completedIds.length}
        streak={streak}
        lastVisit={lastVisit}
        onLeaderboard={handleLeaderboard}
      />
      <QuestList completedIds={completedIds} onSelect={(q) => setSelectedQuest(q)} />
      <div className="h-20" />

      {selectedQuest && (
        <QuestModal
          quest={selectedQuest}
          isCompleted={completedIds.includes(selectedQuest.id)}
          onClose={() => setSelectedQuest(null)}
          onComplete={handleComplete}
        />
      )}

      <AnimatePresence>
        {showLeaderboard && (
          <LeaderboardModal
            data={leaderboardData}
            myKey={tossUserKey}
            onClose={() => setShowLeaderboard(false)}
          />
        )}
      </AnimatePresence>

      <Confetti show={showConfetti} />

      <AnimatePresence>
        {pointToast && (
          <PointToast key={pointToast.points + Date.now()} points={pointToast.points} onDone={() => setPointToast(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {levelUp && (
          <LevelUpOverlay key="levelup" level={levelUp.level} onDone={() => setLevelUp(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
