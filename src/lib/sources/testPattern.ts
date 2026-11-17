export const TEST_PATTERN_HZ = 7.3;

const WIDTH = 640;
const HEIGHT = 360;
const PLUCK_EVERY_S = 4;
const DECAY_S = 1.1;
const PLUCK_HEIGHT_PX = 46;
const CAPTURE_FPS = 60;

export interface TestPattern {
  stream: MediaStream;
  stop: () => void;
}

// A drawn string plucked at a known frequency, fed through the same pipeline as a camera.
export function createTestPattern(): TestPattern {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;
  const startedAt = performance.now();
  let handle = 0;

  const draw = () => {
    const elapsed = (performance.now() - startedAt) / 1000;
    const sincePluck = elapsed % PLUCK_EVERY_S;
    const sag =
      PLUCK_HEIGHT_PX *
      Math.exp(-sincePluck / DECAY_S) *
      Math.sin(2 * Math.PI * TEST_PATTERN_HZ * sincePluck);

    ctx.fillStyle = "#dfe5e8";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.strokeStyle = "#12222b";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(40, HEIGHT / 2);
    ctx.quadraticCurveTo(WIDTH / 2, HEIGHT / 2 + 2 * sag, WIDTH - 40, HEIGHT / 2);
    ctx.stroke();
    handle = requestAnimationFrame(draw);
  };
  draw();

  const stream = canvas.captureStream(CAPTURE_FPS);
  return {
    stream,
    stop: () => {
      cancelAnimationFrame(handle);
      stream.getTracks().forEach((track) => track.stop());
    },
  };
}
