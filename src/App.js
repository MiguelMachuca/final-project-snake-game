import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase/config.js';
import Auth from './components/Auth.js';
import Leaderboard from './components/Leaderboard.js';
import './App.css';

const GRID_SIZE = 20;
const CELL_SIZE = 20;
const GAME_SPEED = 150;

const Direction = {
    UP: 'UP',
    DOWN: 'DOWN',
    LEFT: 'LEFT',
    RIGHT: 'RIGHT'
};

const App = () => {
    const [snake, setSnake] = useState([{ x: 10, y: 10 }]);
    const [food, setFood] = useState({ x: 5, y: 5 });
    const [direction, setDirection] = useState(Direction.RIGHT);
    const [gameOver, setGameOver] = useState(false);
    const [score, setScore] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [user, setUser] = useState(null);
    const [showAuth, setShowAuth] = useState(true);

    // Verificar estado de autenticación
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            if (user) {
                setShowAuth(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            setShowAuth(true);
            setGameOver(false);
            setIsPlaying(false);
            setScore(0);
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
    };

    const handleAuthSuccess = () => {
        setShowAuth(false);
    };

    // ... (el resto del código del juego se mantiene igual, solo agregamos las funciones anteriores)

    // Generar comida aleatoria
    const generateFood = useCallback(() => {
        const newFood = {
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE)
        };

        const isOnSnake = snake.some(segment =>
            segment.x === newFood.x && segment.y === newFood.y
        );

        if (isOnSnake) {
            return generateFood();
        }

        return newFood;
    }, [snake]);

    // Inicializar juego
    const initGame = () => {
        if (!user) {
            setShowAuth(true);
            return;
        }
        setSnake([{ x: 10, y: 10 }]);
        setFood(generateFood());
        setDirection(Direction.RIGHT);
        setGameOver(false);
        setScore(0);
        setIsPlaying(true);
    };

    // Manejar teclas
    const handleKeyPress = useCallback((e) => {
        if (!isPlaying || !user) return;

        switch (e.key) {
            case 'ArrowUp':
                if (direction !== Direction.DOWN) setDirection(Direction.UP);
                break;
            case 'ArrowDown':
                if (direction !== Direction.UP) setDirection(Direction.DOWN);
                break;
            case 'ArrowLeft':
                if (direction !== Direction.RIGHT) setDirection(Direction.LEFT);
                break;
            case 'ArrowRight':
                if (direction !== Direction.LEFT) setDirection(Direction.RIGHT);
                break;
            default:
                break;
        }
    }, [direction, isPlaying, user]);

    // Efecto para manejar teclas
    useEffect(() => {
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [handleKeyPress]);

    // Lógica principal del juego
    useEffect(() => {
        if (!isPlaying || gameOver || !user) return;

        const moveSnake = () => {
            setSnake(prevSnake => {
                const head = { ...prevSnake[0] };

                switch (direction) {
                    case Direction.UP:
                        head.y -= 1;
                        break;
                    case Direction.DOWN:
                        head.y += 1;
                        break;
                    case Direction.LEFT:
                        head.x -= 1;
                        break;
                    case Direction.RIGHT:
                        head.x += 1;
                        break;
                    default:
                        break;
                }

                // Verificar colisiones con paredes
                if (
                    head.x < 0 || head.x >= GRID_SIZE ||
                    head.y < 0 || head.y >= GRID_SIZE
                ) {
                    setGameOver(true);
                    setIsPlaying(false);
                    return prevSnake;
                }

                // Verificar colisión consigo misma
                if (prevSnake.some((segment, index) =>
                    index > 0 && segment.x === head.x && segment.y === head.y
                )) {
                    setGameOver(true);
                    setIsPlaying(false);
                    return prevSnake;
                }

                const newSnake = [head, ...prevSnake.slice(0, -1)];

                // Verificar si come comida
                if (head.x === food.x && head.y === food.y) {
                    newSnake.push({ ...prevSnake[prevSnake.length - 1] });
                    setFood(generateFood());
                    setScore(prev => prev + 10);
                }

                return newSnake;
            });
        };

        const gameInterval = setInterval(moveSnake, GAME_SPEED);
        return () => clearInterval(gameInterval);
    }, [direction, food, generateFood, isPlaying, gameOver, user]);

    // Renderizar celda
    const renderCell = (x, y) => {
        const isSnake = snake.some(segment => segment.x === x && segment.y === y);
        const isHead = snake[0].x === x && snake[0].y === y;
        const isFood = food.x === x && food.y === y;

        let className = 'cell';
        if (isHead) className += ' head';
        else if (isSnake) className += ' snake';
        else if (isFood) className += ' food';

        return <div key={`${x}-${y}`} className={className} />;
    };

    // Renderizar grid
    const renderGrid = () => {
        const grid = [];
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                grid.push(renderCell(x, y));
            }
        }
        return grid;
    };

    if (showAuth) {
        return <Auth onAuthSuccess={handleAuthSuccess} />;
    }

    return (
        <div className="app">
            <div className="game-container">
                <div className="header">
                    <div className="user-info">
                        <span>👤 {user?.displayName || user?.email}</span>
                        <button onClick={handleLogout} className="logout-btn">Cerrar Sesión</button>
                    </div>
                    <h1>🐍 Snake Game</h1>
                    <div className="score">Puntuación: {score}</div>
                </div>

                <div className="game-board">
                    {renderGrid()}
                </div>

                <div className="controls">
                    {!isPlaying && (
                        <button
                            className="start-button"
                            onClick={initGame}
                        >
                            {gameOver ? 'Jugar de Nuevo' : 'Comenzar Juego'}
                        </button>
                    )}

                    {gameOver && (
                        <div className="game-over">
                            <h2>¡Game Over!</h2>
                            <p>Puntuación final: {score}</p>
                        </div>
                    )}
                </div>

                <Leaderboard score={score} gameOver={gameOver} />

                <div className="instructions">
                    <p>Usa las flechas del teclado para mover la serpiente</p>
                </div>
            </div>
        </div>
    );
};

export default App;