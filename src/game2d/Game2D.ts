import { Vector2 } from "three";
import Bird from "../game/Bird";
import Pipe2D from "./Pipe2D";
import Laser, { LASER_LEN, LASER_WIDTH, LaserColor } from "./Laser";

export const BIRD_WIDTH = 34 * 2;
export const BIRD_HEIGHT = 24 * 2;
export const BIRD_X = 50;
export const BIRD_JUMP_VELOCITY = -10;
export const BIRD_GRAVITY = 0.6;
export const PIPE_WIDTH = 75;
export const PIPE_HEIGHT = 500;
export const PIPE_VELOCITY = -5;
export const FLOOR_WIDTH = 500;
export const FLOOR_HEIGHT = 100;

export const LEVELS = [
    {
        requiredScore: 0,
        speed: 1,
        pipeSpacing: 200,
        pipeInterval: 100,
        movingPipes: false,
        lasers: false,
        laserCount: 5,
        laserInterval: 200,
    },
    {
        requiredScore: 10,
        speed: 1.5,
        pipeSpacing: 150,
        pipeInterval: 70,
        movingPipes: false,
        lasers: false,
    },
    {
        requiredScore: 20,
        speed: 2,
        pipeSpacing: 100,
        pipeInterval: 50,
        movingPipes: true,
        lasers: false,
    },
    {
        requiredScore: 30,
        speed: 2,
        pipeSpacing: 200,
        pipeInterval: 50,
        movingPipes: true,
        lasers: true,
        laserCount: 2,
        laserInterval: 200,
    },
    {
        requiredScore: 40,
        speed: 2,
        pipeSpacing: 200,
        pipeInterval: 50,
        movingPipes: true,
        lasers: false,
        // laserCount: 10,
        // laserInterval: 100,
    }
]

export enum GameState {
    NORMAL_PIPES,
    MORE_PIPES,
    MOVING_PIPES,
    LASER,
    PORTAL
}

export default class Game2D {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    bird: Bird;
    pipes: Pipe2D[];
    bullets: Laser[];
    isGameOver: boolean;

    private lastTime?: Date;
    private frameCount = 0;

    score = 0;
    stage: GameState = GameState.NORMAL_PIPES;

    constructor() {
        this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        this.canvas.style.backgroundImage = 'url("src/assets/flappy-bird/sprites/background-day.png")';

        this.bird = new Bird(BIRD_X, 0, 0);
        this.bird.acceleration.y = BIRD_GRAVITY;
        this.pipes = [];
        this.bullets = [];
        this.isGameOver = false;

        this.setupEventListeners();
    }

    start() {
        this.gameLoop();
    }

    private setupEventListeners() {
        document.addEventListener('keydown', (event) => {
            if (event.key === ' ') {
                this.jump();
            }
        });
    }

    private gameLoop() {
        if (this.isGameOver) {
            return;
        }

        const delta = this.delta();

        this.update(delta);
        this.render();

        this.frameCount++
        requestAnimationFrame(() => this.gameLoop());
    }

    // Updating

    private update(delta: number) {
        // Check for collision with pipes or ground
        const isInTopPipe = this.pipes.some((pipe) => pipe.position.x < this.bird.position.x + BIRD_WIDTH && pipe.position.x + pipe.width > this.bird.position.x && pipe.position.y < this.bird.position.y + BIRD_HEIGHT && pipe.position.y + pipe.height > this.bird.position.y);
        const isInBottomPipe = this.pipes.some((pipe) => pipe.position.x < this.bird.position.x + BIRD_WIDTH && pipe.position.x + pipe.width > this.bird.position.x && pipe.position.y + pipe.height + pipe.spacing < this.bird.position.y + BIRD_HEIGHT && pipe.position.y + pipe.height + pipe.spacing + window.innerHeight - pipe.height - pipe.spacing > this.bird.position.y);
        const isInPipe = isInTopPipe || isInBottomPipe;
        const isAboveGround = this.bird.position.y + BIRD_HEIGHT + FLOOR_HEIGHT < window.innerHeight;
        const isInLaser = this.bullets.some((laser) => {
            const xStart = laser.position.x;
            const xEnd = laser.position.x + LASER_WIDTH;
            const yStart = laser.position.y;
            const yEnd = laser.position.y + LASER_LEN;

            const xBirdStart = this.bird.position.x;
            const xBirdEnd = this.bird.position.x + BIRD_WIDTH;
            const yBirdStart = this.bird.position.y;
            const yBirdEnd = this.bird.position.y + BIRD_HEIGHT;

            return xStart < xBirdEnd && xEnd > xBirdStart && yStart < yBirdEnd && yEnd > yBirdStart;
        });

        if (isInPipe || !isAboveGround || isInLaser) {
            this.isGameOver = true;
        }

        this.updateBird(delta);
        this.updatePipes(delta);

        // Remove offscreen pipes
        this.pipes = this.pipes.filter((pipe) => !pipe.hasFinishedPassing());

        // Add new pipe every x frames
        if (this.frameCount % this.getLevel().pipeInterval === 0) {
            const randomHeight = (Math.random() * 0.5) * window.innerHeight;
            const randomSpacing = Math.random() * this.getLevel().pipeSpacing + this.getLevel().pipeSpacing;

            this.pipes.push(new Pipe2D(PIPE_WIDTH, randomHeight, randomSpacing, new Vector2(window.innerWidth, 0)));
        }

        // Part 1/2 of laser update, it's also updating in the render method
        this.updateLasers(delta);

        if (this.getLevel().lasers && this.getLevel().laserInterval) {
            if (this.frameCount % this.getLevel().laserInterval! === 0) {
                for (let i = 0; i < this.getLevel().laserCount!; i++) {
                    // const randomX = Math.random() * window.innerWidth + 100;
                    const randomY = Math.random() * window.innerHeight;

                    this.bullets.push(new Laser(this.canvas, this.ctx, new Vector2(window.innerWidth, window.innerHeight * Math.random()), new Vector2(BIRD_X, randomY), LaserColor.RED));
                }
            }
        }
    }

    private updateBird(delta: number) {
        this.bird.move(delta);
    }

    private updatePipes(delta: number) {
        this.pipes.forEach((pipe) => {
            pipe.move(delta, this.getLevel().speed);

            if (this.getLevel().movingPipes) {
                const direction = pipe.position.y + pipe.spacing / 2 > window.innerHeight / 4 ? 1 : -1;
                pipe.position.y += Math.sin(this.frameCount / 10) * 5 * direction;
            }

            if (pipe.position.x + pipe.width < this.bird.position.x && !pipe.passed) {
                this.score++;
                pipe.passed = true;

                if (this.score == 69)
                    this.score++

                while (this.stage < LEVELS.length - 1 && this.score >= LEVELS[this.stage + 1].requiredScore) {
                    this.stage++;
                }
            }
        });
    }

    private updateLasers(_: number) {
        for (let i = 0; i < this.bullets.length; i++) {
            // this.bullets[i].initialPosition.x += PIPE_VELOCITY * this.getLevel().speed * delta * 60;
            // this.bullets[i].finalPosition.x += PIPE_VELOCITY * this.getLevel().speed * delta * 60;
        }
    }

    // Rendering

    private render() {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform
        this.ctx.globalAlpha = 1; // reset alpha
        this.ctx.globalCompositeOperation = "source-over"; 

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.renderBird()
        this.renderPipes();
        this.renderGround();
        this.renderScore();
        this.renderLasers();

        if (this.isGameOver) {
            this.ctx.fillStyle = 'red';
            this.ctx.font = '48px Arial';
            this.ctx.fillText('Game Over', this.canvas.width / 2 - 100, this.canvas.height / 2);
        }
    }

    private renderBird() {
        const birdState = Math.floor(this.frameCount / 10) % 3;
        const birdImage = new Image();
        const birdImageNames = [
            'downflap',
            'midflap',
            'upflap',
        ];
        
        birdImage.src = `src/assets/flappy-bird/sprites/yellowbird-${birdImageNames[birdState]}.png`;
        this.ctx.drawImage(birdImage, this.bird.position.x, this.bird.position.y, BIRD_WIDTH, BIRD_HEIGHT);
    }

    private renderPipes() {
        this.pipes.forEach((pipe) => {
            const pipeImage = new Image();
            pipeImage.src = `src/assets/flappy-bird/sprites/pipe-${this.getLevel().movingPipes ? "red" : "green"}.png`;

            this.ctx.save();
            this.ctx.scale(1, -1);
            this.ctx.drawImage(pipeImage, pipe.position.x, -pipe.position.y - pipe.height, pipe.width, window.innerHeight / 1.5);
            this.ctx.restore();

            this.ctx.drawImage(pipeImage, pipe.position.x, pipe.position.y + pipe.height + pipe.spacing, pipe.width, window.innerHeight / 1.5);
        });
    }

    private renderGround() {
        const groundImage = new Image();
        groundImage.src = 'src/assets/flappy-bird/sprites/base.png';

        for (let i = 0; i < 6; i++) {
            const deviation = this.frameCount * Math.abs(PIPE_VELOCITY * this.getLevel().speed);
            const normalizedDeviation = deviation % FLOOR_WIDTH;

            this.ctx.drawImage(groundImage, i * FLOOR_WIDTH - normalizedDeviation, window.innerHeight - FLOOR_HEIGHT, FLOOR_WIDTH, FLOOR_HEIGHT);
        }
    }

    private renderScore() {
        this.ctx.fillStyle = 'black';
        this.ctx.font = '24px Calibri';
        this.ctx.fillText(`Score: ${this.score}`, 10, 50);

        // High score
        const highScore = localStorage.getItem('highScore');
        const currentHighScore = highScore ? parseInt(highScore) : 0;

        if (this.score > currentHighScore) {
            localStorage.setItem('highScore', this.score.toString());
        }

        this.ctx.fillText(`High score: ${currentHighScore}`, 10, 80);
    }

    private renderLasers() {
        for (let i = 0; i < this.bullets.length; i++) {
            if (this.bullets[i].life < 0) {
                this.bullets.splice(i, 1);
                continue;
            }

            this.bullets[i].updateAndDraw();
        }
    }

    // Helpers

    private getLevel() {
        return LEVELS[this.stage];
    }

    private jump() {
        this.bird.velocity.y = BIRD_JUMP_VELOCITY;
    }

    private delta() {
        if (!this.lastTime) {
            this.lastTime = new Date();
            return 0;
        }

        const currentTime = new Date();
        const delta = currentTime.getTime() - this.lastTime.getTime();
        this.lastTime = currentTime;

        return delta / 1000;
    }
}
