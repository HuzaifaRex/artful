import confetti from "canvas-confetti";

const COLORS = ["#5C3243", "#D4A373", "#E9D8A6", "#B56576", "#FAF7F2"];

export function burstConfetti() {
  const end = Date.now() + 900;
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0 }, colors: COLORS });
    confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1 }, colors: COLORS });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
  confetti({ particleCount: 120, spread: 90, startVelocity: 42, origin: { y: 0.6 }, colors: COLORS });
}

export function popConfetti(origin = { y: 0.35 }) {
  confetti({ particleCount: 90, spread: 70, startVelocity: 38, origin, colors: COLORS });
}
