import React, { useState, useEffect } from 'react';
import {
    collection,
    addDoc,
    query,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase/config.js';
import './Leaderboard.css';

const Leaderboard = ({ score, gameOver }) => {
    const [scores, setScores] = useState([]);
    const [showLeaderboard, setShowLeaderboard] = useState(false);

    // Guardar puntuación cuando el juego termina
    useEffect(() => {
        if (gameOver && score > 0 && auth.currentUser) {
            saveScore();
        }
    }, [gameOver, score]);

    // Obtener mejores puntuaciones
    useEffect(() => {
        const q = query(
            collection(db, 'scores'),
            orderBy('score', 'desc'),
            limit(10)
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const scoresData = [];
            querySnapshot.forEach((doc) => {
                scoresData.push({ id: doc.id, ...doc.data() });
            });
            setScores(scoresData);
        });

        return () => unsubscribe();
    }, []);

    const saveScore = async () => {
        try {
            await addDoc(collection(db, 'scores'), {
                userId: auth.currentUser.uid,
                userName: auth.currentUser.displayName || auth.currentUser.email,
                score: score,
                timestamp: serverTimestamp()
            });
        } catch (error) {
            console.error('Error guardando puntuación:', error);
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate();
        return date.toLocaleDateString('es-ES');
    };

    return (
        <div className="leaderboard-container">
            <button
                className="toggle-leaderboard"
                onClick={() => setShowLeaderboard(!showLeaderboard)}
            >
                {showLeaderboard ? 'Ocultar Ranking' : 'Ver Ranking'}
            </button>

            {showLeaderboard && (
                <div className="leaderboard">
                    <h3>🏆 Mejores Puntuaciones</h3>
                    <div className="scores-list">
                        {scores.length === 0 ? (
                            <p className="no-scores">No hay puntuaciones aún</p>
                        ) : (
                            scores.map((scoreItem, index) => (
                                <div
                                    key={scoreItem.id}
                                    className={`score-item ${auth.currentUser && scoreItem.userId === auth.currentUser.uid ? 'current-user' : ''}`}
                                >
                                    <span className="rank">#{index + 1}</span>
                                    <span className="name">{scoreItem.userName}</span>
                                    <span className="score">{scoreItem.score} pts</span>
                                    <span className="date">{formatDate(scoreItem.timestamp)}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Leaderboard;