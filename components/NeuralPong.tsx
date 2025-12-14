import React, { useEffect, useRef } from 'react';

interface NeuralPongProps {
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
  isActive: boolean;
}

const NeuralPong: React.FC<NeuralPongProps> = ({ onCanvasReady, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameState = useRef({
    ballX: 300, ballY: 200, ballDX: 4, ballDY: 4,
    paddleY: 150, paddleHeight: 80, paddleWidth: 10,
    score: 0
  });

  useEffect(() => {
    if (canvasRef.current) {
      onCanvasReady(canvasRef.current);
    }
  }, [onCanvasReady]);

  // Game Loop
  useEffect(() => {
    if (!isActive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const width = canvas.width;
    const height = canvas.height;

    const loop = () => {
      // Logic
      const state = gameState.current;
      
      // Ball movement
      state.ballX += state.ballDX;
      state.ballY += state.ballDY;

      // Wall collision
      if (state.ballY < 0 || state.ballY > height) state.ballDY *= -1;
      
      // Paddle collision
      if (state.ballX > width - 20) { // Right side paddle
        if (state.ballY > state.paddleY && state.ballY < state.paddleY + state.paddleHeight) {
           state.ballDX *= -1.1; // Speed up
           state.score++;
        } else if (state.ballX > width) {
           // Reset
           state.ballX = width / 2;
           state.ballY = height / 2;
           state.ballDX = -4;
           state.score = 0;
        }
      }
      
      // Left wall bounce
      if (state.ballX < 0) state.ballDX *= -1;

      // AI Paddle movement (simple tracking with lag)
      // For "Interactive" mode, we usually want user input, but for this demo, 
      // let's make it auto-play or listen to mouse if we can.
      // Let's attach mouse listener to window since canvas is hidden usually.
      
      // Render
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      // Draw middle line
      ctx.strokeStyle = '#333';
      ctx.setLineDash([5, 15]);
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Paddle
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'white';
      ctx.fillRect(width - 20, state.paddleY, state.paddleWidth, state.paddleHeight);

      // Draw Ball
      ctx.beginPath();
      ctx.arc(state.ballX, state.ballY, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw Score
      ctx.font = '40px monospace';
      ctx.fillText(state.score.toString(), width / 2 - 15, 50);

      animId = requestAnimationFrame(loop);
    };

    loop();
    
    // Mouse handler for paddle
    const handleMouseMove = (e: MouseEvent) => {
        // Map screen Y to canvas Y
        const relativeY = (e.clientY / window.innerHeight) * height;
        gameState.current.paddleY = relativeY - gameState.current.paddleHeight/2;
    };
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isActive]);

  return (
    <canvas 
      ref={canvasRef} 
      width={640} 
      height={360} 
      className="hidden" // Hidden canvas, consumed by BlindsightCanvas
    />
  );
};

export default NeuralPong;