import React, { useState } from 'react';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile
} from 'firebase/auth';
import { auth } from '../firebase/config.js';
import './Auth.css';

const Auth = ({ onAuthSuccess }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (isLogin) {
                // Login
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                // Registro
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, {
                    displayName: displayName
                });
            }
            onAuthSuccess();
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <h2>{isLogin ? 'Iniciar Sesión' : 'Registrarse'}</h2>

                <form onSubmit={handleSubmit} className="auth-form">
                    {!isLogin && (
                        <div className="form-group">
                            <input
                                type="text"
                                placeholder="Nombre de usuario"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                required={!isLogin}
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <input
                            type="email"
                            placeholder="Correo electrónico"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <input
                            type="password"
                            placeholder="Contraseña"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <button type="submit" disabled={loading} className="auth-button">
                        {loading ? 'Cargando...' : (isLogin ? 'Iniciar Sesión' : 'Registrarse')}
                    </button>
                </form>

                <div className="auth-switch">
                    <p>
                        {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
                        <button
                            type="button"
                            onClick={() => setIsLogin(!isLogin)}
                            className="switch-button"
                        >
                            {isLogin ? 'Regístrate' : 'Inicia Sesión'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Auth;
