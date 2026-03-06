import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── 타이머 안내 문구 ─────────────────────────────────────────────────────────
const TIMER_HINTS = {
  1: ["코로 천천히 들이마시고... 🌬️","4초 동안 숨을 채워요...","입으로 길게 내뱉으세요... 😮‍💨","스트레스가 빠져나가는 중..."],
  2: ["혀를 천장에 꾹 밀착! 👅","턱을 살짝 당기고 유지...","그대로! 페이스 리프팅 중...","거의 다 왔어요, 버텨요! 💪"],
  4: ["양손을 허벅지에 올려요 🤲","힘껏! 아래로 눌러요...","등 근육이 수축하는 느낌?","아무도 모르게 운동 중... 💪"],
  5: ["멀리 있는 벽을 바라봐요 👁️","눈의 긴장을 풀어주세요...","깜빡이지 않아도 괜찮아요","망막이 감사하고 있습니다 ✨"],
  6: ["손가락을 깍지 껴요 🤲","손목을 천천히 돌리고...","반대 방향으로도 돌려요","타이피스트 직업병 퇴치 중! ⌨️"],
};
const DEFAULT_HINTS = ["집중! 거의 다 왔어요 💪","그대로 유지하세요...","아무도 모르게 건강해지는 중","10초만 버텨요! ✨"];

// ─── 퀘스트 데이터 ────────────────────────────────────────────────────────────
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

// ─── useTimer 훅 ──────────────────────────────────────────────────────────────
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

// ─── useSensor 훅 ─────────────────────────────────────────────────────────────
function useSensor({ goal = 10, threshold = 2.5, cooldown = 500 }) {
  const [permission, setPermission] = useState("idle"); // idle | requesting | granted | denied
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);
  const [bump, setBump] = useState(0); // 애니메이션 트리거용
  const lastTriggerRef = useRef(0);
  const peakRef = useRef(false); // 피크 감지 상태

  // 권한 요청
  const requestPermission = useCallback(async () => {
    setPermission("requesting");
    try {
      if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
        // iOS 13+
        const result = await DeviceMotionEvent.requestPermission();
        setPermission(result === "granted" ? "granted" : "denied");
      } else {
        // Android / 데스크톱 (권한 팝업 없이 바로 허용)
        setPermission("granted");
      }
    } catch (e) {
      setPermission("denied");
    }
  }, []);

  // 모션 감지
  useEffect(() => {
    if (permission !== "granted" || done) return;

    const handleMotion = (e) => {
      const accel = e.accelerationIncludingGravity;
      if (!accel) return;

      // Y축과 Z축 중 최대 절댓값 사용
      const val = Math.max(Math.abs(accel.y ?? 0), Math.abs(accel.z ?? 0));
      const now = Date.now();

      // 피크(상승) 감지
      if (val > threshold && !peakRef.current) {
        peakRef.current = true;
      }
      // 복귀(하강) 감지 → 1회 카운트
      if (val < threshold * 0.5 && peakRef.current) {
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

// ─── CircleProgress ───────────────────────────────────────────────────────────
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

// ─── Header ───────────────────────────────────────────────────────────────────
function Header({ points, completed }) {
  const lv = getLevel(points);
  const nextLv = LEVELS.find((l) => l.min > points);
  const curMin = getLevel(points).min;
  const progress = nextLv ? ((points - curMin) / (nextLv.min - curMin)) * 100 : 100;
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
          <p className="text-xs text-gray-400 mb-0.5">모은 포인트</p>
          <p className="text-2xl font-bold text-blue-600">{points.toLocaleString()}P</p>
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
      <div className="flex items-center gap-1.5 mt-3">
        <div className="bg-blue-50 text-blue-600 text-xs font-semibold px-2.5 py-1 rounded-full">
          오늘 {completed}/{QUESTS.length} 완료
        </div>
        {completed === QUESTS.length && (
          <div className="bg-yellow-50 text-yellow-600 text-xs font-semibold px-2.5 py-1 rounded-full animate-pulse">🎊 모두 완료!</div>
        )}
      </div>
    </div>
  );
}

// ─── QuestCard ────────────────────────────────────────────────────────────────
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

// ─── QuestList ────────────────────────────────────────────────────────────────
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

// ─── TimerView ────────────────────────────────────────────────────────────────
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
            transition={running ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" } : {}}
          >
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
            <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-gray-400 text-center">
              버튼을 눌러 10초 타이머를 시작하세요
            </motion.p>
          )}
          {done && (
            <motion.p key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-base font-bold text-blue-600 text-center">
              🎉 완료! 수고했어요!
            </motion.p>
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

// ─── SensorView (까치발 펌핑 전용) ───────────────────────────────────────────
function SensorView({ quest, onComplete }) {
  const goal = quest.goal ?? 10;
  const { permission, count, done, bump, requestPermission } = useSensor({ goal });
  const progress = count / goal;

  // 도넛 안의 숫자 bump 애니메이션 key
  const bumpKey = bump;

  return (
    <div className="flex flex-col items-center py-2">

      {/* ── 권한 미허용 상태 ── */}
      {permission === "idle" && (
        <div className="w-full flex flex-col items-center gap-5 py-4">
          <div className="w-20 h-20 bg-green-50 rounded-3xl flex items-center justify-center text-4xl">🦶</div>
          <div className="bg-gray-50 rounded-2xl p-4 w-full">
            <p className="text-sm text-gray-600 leading-relaxed text-center">
              까치발 감지를 위해<br />스마트폰 모션 센서 접근이 필요해요.
            </p>
          </div>
          <button onClick={requestPermission}
            className="w-full bg-blue-600 text-white font-bold text-base py-4 rounded-2xl active:bg-blue-700 transition-colors">
            📡 센서 권한 허용하기
          </button>
        </div>
      )}

      {/* ── 권한 요청 중 ── */}
      {permission === "requesting" && (
        <div className="w-full flex flex-col items-center gap-4 py-8">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full" />
          <p className="text-sm text-gray-500">권한 요청 중...</p>
        </div>
      )}

      {/* ── 권한 거부 ── */}
      {permission === "denied" && (
        <div className="w-full flex flex-col items-center gap-4 py-6">
          <div className="text-4xl">😢</div>
          <p className="text-sm text-gray-500 text-center">센서 권한이 거부됐어요.<br />기기 설정에서 허용 후 다시 시도해 주세요.</p>
          <button onClick={requestPermission}
            className="w-full bg-gray-100 text-gray-600 font-bold text-base py-4 rounded-2xl">
            다시 시도하기
          </button>
        </div>
      )}

      {/* ── 센서 활성 상태: 카운팅 UI ── */}
      {permission === "granted" && (
        <>
          <CircleProgress progress={progress} size={180} strokeWidth={10}>
            <div className="flex flex-col items-center gap-0.5">
              {/* 까치발 이모지 pulse */}
              <motion.span className="text-4xl select-none"
                animate={!done ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                transition={!done ? { duration: 0.8, repeat: Infinity, ease: "easeInOut" } : {}}>
                {done ? "✅" : "🦶"}
              </motion.span>
              {/* 카운트 숫자 — bump 시 튀어오름 */}
              <AnimatePresence mode="wait">
                <motion.span
                  key={bumpKey}
                  initial={{ scale: 1.6, color: "#2563EB" }}
                  animate={{ scale: 1, color: "#111827" }}
                  transition={{ type: "spring", stiffness: 400, damping: 18 }}
                  className="text-4xl font-black tabular-nums leading-none"
                >
                  {count}
                </motion.span>
              </AnimatePresence>
              <span className="text-xs text-gray-400 font-medium">/ {goal}회</span>
            </div>
          </CircleProgress>

          {/* 안내 문구 */}
          <div className="mt-5 mb-5 h-6 flex items-center justify-center w-full">
            <AnimatePresence mode="wait">
              {!done ? (
                <motion.p key="guide" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="text-sm text-gray-500 text-center">
                  {count === 0 ? "발뒤꿈치를 들었다 내렸다! 반복하세요 🦵" : `잘하고 있어요! ${goal - count}번만 더!`}
                </motion.p>
              ) : (
                <motion.p key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  className="text-base font-bold text-blue-600 text-center">
                  🎉 {goal}회 달성! 종아리 칭찬해!
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* 카운트 도트 시각화 */}
          <div className="flex gap-1.5 flex-wrap justify-center mb-6">
            {Array.from({ length: goal }).map((_, i) => (
              <motion.div key={i}
                initial={{ scale: 0.8 }}
                animate={{ scale: i < count ? 1 : 0.8, backgroundColor: i < count ? "#2563EB" : "#E5E7EB" }}
                transition={{ type: "spring", stiffness: 300 }}
                className="w-5 h-5 rounded-full"
              />
            ))}
          </div>

          {/* 버튼 */}
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

// ─── QuestModal ───────────────────────────────────────────────────────────────
function QuestModal({ quest, onClose, onComplete, isCompleted }) {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState("info"); // "info" | "timer" | "sensor"

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  const handleClose = () => { setVisible(false); setTimeout(onClose, 300); };
  const handleComplete = () => { onComplete(quest); handleClose(); };

  if (!quest) return null;

  const startPhase = quest.type === "timer" ? "timer" : "sensor";

  return (
    <>
      <div className="fixed inset-0 bg-black z-40 transition-opacity duration-300"
        style={{ opacity: visible ? 0.4 : 0 }} onClick={handleClose} />
      <div className="fixed bottom-0 left-1/2 w-full max-w-md bg-white rounded-t-3xl z-50 transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-50%) translateY(${visible ? "0%" : "100%"})` }}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        <div className="px-6 pt-3 pb-10">
          {/* 퀘스트 헤더 */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-2xl">{quest.emoji}</div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">{quest.title}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${quest.tagColor}`}>{quest.tag}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{quest.desc}</p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {/* ── info 페이즈 ── */}
            {phase === "info" && (
              <motion.div key="info" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <div className="bg-gray-50 rounded-2xl p-4 mb-4">
                  <p className="text-sm text-gray-700 leading-relaxed">{quest.detail}</p>
                </div>
                <div className="flex items-center justify-between bg-blue-50 rounded-2xl px-4 py-3 mb-5">
                  <span className="text-sm font-medium text-gray-600">완료 시 보상</span>
                  <span className="text-lg font-bold text-blue-600">+{quest.points}P</span>
                </div>
                {isCompleted ? (
                  <div className="w-full bg-gray-100 text-gray-400 font-bold text-base py-4 rounded-2xl text-center">✅ 오늘은 이미 완료했어요</div>
                ) : (
                  <button onClick={() => setPhase(startPhase)}
                    className="w-full bg-blue-600 text-white font-bold text-base py-4 rounded-2xl active:bg-blue-700 transition-colors">
                    지금 바로 시작하기 →
                  </button>
                )}
              </motion.div>
            )}

            {/* ── timer 페이즈 ── */}
            {phase === "timer" && (
              <motion.div key="timer" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <TimerView quest={quest} onComplete={handleComplete} />
              </motion.div>
            )}

            {/* ── sensor 페이즈 ── */}
            {phase === "sensor" && (
              <motion.div key="sensor" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <SensorView quest={quest} onComplete={handleComplete} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [points, setPoints] = useState(0);
  const [completedIds, setCompletedIds] = useState([]);
  const [selectedQuest, setSelectedQuest] = useState(null);

  const handleComplete = (quest) => {
    if (completedIds.includes(quest.id)) return;
    setCompletedIds((prev) => [...prev, quest.id]);
    setPoints((prev) => prev + quest.points);
  };

  return (
    <div className="bg-gray-50 min-h-screen max-w-md mx-auto relative overflow-x-hidden">
      <Header points={points} completed={completedIds.length} />
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
    </div>
  );
}
