import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

interface Transaction {
  id: number;
  description: string;
  amount: number;
  date: string;
  paymentMethod: 'card' | 'cash';
  bank?: string;
  isTransfer?: boolean;
  transferId?: number;
  category?: string; // For expenses
  fixedExpenseId?: number;
}

interface FixedExpense {
  id: number;
  description: string;
  amount: number;
  category: string;
}

interface Bank {
  name:string;
  color: string;
}

interface Category {
  name: string;
  icon: string; // key of CategoryIcons
}

interface Country {
  code: string;
  name: string;
  currency: string;
  locale: string;
  flag: string;
}

interface CombinedTransaction extends Transaction {
  type: 'income' | 'expense';
}

interface RenderableTransfer {
  id: number; // The ID of the expense part of the transaction for deletion
  transferId: number;
  amount: number;
  date: string;
  from: { method: 'card' | 'cash'; bank?: string };
  to: { method: 'card' | 'cash'; bank?: string };
  type: 'transfer';
  originalType: 'expense'; // So we know which array to look in for deletion
}

type RenderableTransaction = CombinedTransaction | RenderableTransfer;

// --- ICONS ---

const FilterIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
    </svg>
);

const HomeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
    </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);

const PencilIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
    </svg>
);

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const ArrowUpRightIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="7" y1="17" x2="17" y2="7"></line>
        <polyline points="7 7 17 7 17 17"></polyline>
    </svg>
);

const ArrowDownLeftIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="17" y1="7" x2="7" y2="17"></line>
        <polyline points="17 17 7 17 7 7"></polyline>
    </svg>
);

const TransferIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="17 1 21 5 17 9"></polyline>
        <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
        <polyline points="7 23 3 19 7 15"></polyline>
        <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
    </svg>
);

const SettingsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
);

const RepeatIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
);

const FileTextIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <line x1="10" y1="9" x2="8" y2="9"></line>
    </svg>
);

const CategoryIcons: { [key: string]: React.FC } = {
    'Food': () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D2691E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3z"/></svg>),
    'Transport': () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1E88E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 16.5 17.5 13H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8.5"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>),
    'Shopping': () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8E24AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>),
    'Bills': () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#43A047" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>),
    'Entertainment': () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D81B60" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5.1 9.5 8 15 10.9V5.1z"/><path d="m2 11 2.5-2.5L2 6"/><path d="m22 18-2.5 2.5L22 23"/><path d="M16.5 21.4a2.5 2.5 0 0 1-3.4 0"/><path d="M16 10.9 9.5 8 4 10.9"/><path d="M22 6 9.5 8 4 6"/><path d="M2 13h20"/><path d="M4 18h10.5"/></svg>),
    'Health': () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E53935" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
    'CreditCard': () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#757575" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
    'Briefcase': () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6D4C41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
    'Gift': () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F4511E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>,
    'Home': () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FB8C00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 9v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9"/><path d="M10 22V12h4v10"/><path d="M2 10l10-7 10 7"/></svg>,
    'Book': () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#039BE5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20v2H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v2H6.5A2.5 2.5 0 0 1 4 4.5z"/></svg>,
    'PawPrint': () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#5D4037"><circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="4" cy="8" r="2"/><circle cx="12" cy="13" r="3"/><path d="M19 10c-1.5 0-3 1-3 3s1.5 5 3 5 3-1 3-3-1.5-5-3-5zM5 10c-1.5 0-3 1-3 3s1.5 5 3 5 3-1 3-3-1.5-5-3-5z"/></svg>,
};
const CategoryIcon = ({ iconKey }: { iconKey: string }) => {
    const IconComponent = CategoryIcons[iconKey] || CategoryIcons['CreditCard'];
    return <IconComponent />;
};


// --- UTILITIES & HELPERS ---

// Color Conversion Utilities
function hexToHsl(hex: string): [number, number, number] | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return null;

    let r = parseInt(result[1], 16);
    let g = parseInt(result[2], 16);
    let b = parseInt(result[3], 16);

    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}


function hslToHex(h: number, s: number, l: number): string {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}


// Sorter function for transactions
const transactionSorter = (a: { date: string, id: number }, b: { date: string, id: number }) => {
  const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
  if (dateDiff !== 0) return dateDiff;
  return b.id - a.id; // Newest entry first if dates are the same
};

// Date Formatter
const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  date.setMinutes(date.getMinutes() + date.getTimezoneOffset());

  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const weekdays = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];

  const weekday = weekdays[date.getDay()];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  
  return `${weekday} ${day} ${month} ${year}`;
};


// --- ANIMATION HOOK ---
const useAnimatedCounter = (endValue: number, duration = 800) => {
    const [count, setCount] = useState(endValue);
    const frameRate = 1000 / 60;
    const totalFrames = Math.round(duration / frameRate);
    const valueRef = useRef(endValue);

    useEffect(() => {
        const startValue = valueRef.current;
        const diff = endValue - startValue;
        if (diff === 0) return;

        let frame = 0;
        const counter = setInterval(() => {
            frame++;
            const progress = (frame / totalFrames) ** 2; // Ease-out
            const currentValue = startValue + diff * progress;
            setCount(currentValue);

            if (frame === totalFrames) {
                clearInterval(counter);
                valueRef.current = endValue;
            }
        }, frameRate);

        return () => clearInterval(counter);
    }, [endValue, duration, frameRate, totalFrames]);

    return count;
};

const AnimatedNumber = ({ value, formatCurrency }: { value: number, formatCurrency: (v: number) => string }) => {
    const animatedValue = useAnimatedCounter(value);
    return <span>{formatCurrency(animatedValue)}</span>;
};


// --- MODALS & NAVIGATION ---

const AddTransactionModal = ({ setView, onClose }: { setView: (view: 'income' | 'expenses') => void, onClose: () => void }) => (
    <div className="add-transaction-modal-overlay" onClick={onClose}>
        <div className="add-transaction-modal" onClick={(e) => e.stopPropagation()}>
            <button className="selection-btn btn-income" onClick={() => { setView('income'); onClose(); }}>
                <ArrowUpRightIcon /> Ingreso
            </button>
            <button className="selection-btn btn-expense" onClick={() => { setView('expenses'); onClose(); }}>
                <ArrowDownLeftIcon /> Gasto
            </button>
        </div>
    </div>
);

const BottomNavBar = ({ view, setView, onGoToWelcome }: { view: string; setView: (view: any) => void; onGoToWelcome: () => void; }) => {
    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
    const lastHomeClick = useRef<number>(0);

    const handleHomeClick = () => {
        const now = Date.now();
        const timeSinceLastClick = now - lastHomeClick.current;

        if (timeSinceLastClick < 500) { // Double-click threshold: 500ms
            onGoToWelcome();
            lastHomeClick.current = 0; // Reset after double-click
        } else {
            setView('summary');
            lastHomeClick.current = now;
        }
    };
    
    return (
        <>
            <div className="bottom-nav-bar">
                <button className="nav-item-left" onClick={handleHomeClick} aria-label="Ir al resumen (doble-clic para seleccionar pais)">
                    <HomeIcon />
                </button>
                <div className="nav-fab-container">
                    <button className={`nav-fab ${isAddMenuOpen ? 'open' : ''}`} onClick={() => setIsAddMenuOpen(true)} aria-label="Anadir transaccion">
                        <PlusIcon />
                    </button>
                </div>
                <button className="nav-item-right" onClick={() => setView('settings')} aria-label="Ir a ajustes">
                    <SettingsIcon />
                </button>
            </div>
            {isAddMenuOpen && <AddTransactionModal setView={setView as any} onClose={() => setIsAddMenuOpen(false)} />}
        </>
    );
};

const TransactionDetailModal = ({ isOpen, onClose, title, transactions, banks, formatCurrency, formatDate }: {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    transactions: CombinedTransaction[];
    banks: Bank[];
    formatCurrency: (value: number) => string;
    formatDate: (date: string) => string;
}) => {
    if (!isOpen) return null;

    return (
        <div className="transaction-detail-modal-overlay" onClick={onClose}>
            <div className="transaction-detail-modal" onClick={(e) => e.stopPropagation()}>
                <h2>{title}</h2>
                {transactions.length > 0 ? (
                    <ul className="transaction-detail-list">
                        {transactions.map(transaction => {
                            const bank = transaction.paymentMethod === 'card' && transaction.bank 
                                ? banks.find(b => b.name === transaction.bank) 
                                : null;
                            return (
                                <li key={transaction.id} className="transaction-item">
                                    <div className={`transaction-icon-container ${transaction.type}`}>
                                      {transaction.type === 'income' ? <ArrowUpRightIcon /> : <ArrowDownLeftIcon />}
                                    </div>
                                    <div className="transaction-details">
                                        <div className="transaction-row">
                                            <span className="transaction-description">{transaction.description}</span>
                                            <span className={`transaction-amount ${transaction.type === 'income' ? 'income-amount' : 'expense-amount'}`}>
                                                {transaction.type === 'income' ? '+' : '-'}
                                                {formatCurrency(transaction.amount)}
                                            </span>
                                        </div>
                                        <div className="transaction-row">
                                            <span className="transaction-date">{formatDate(transaction.date)}</span>
                                            <div className="transaction-meta">
                                                {transaction.paymentMethod === 'card' && transaction.bank && (
                                                    <span 
                                                        className="transaction-bank" 
                                                        style={{ backgroundColor: bank ? bank.color : '#424242' }}
                                                    >
                                                        {transaction.bank}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <p className="no-transactions-message">No hay transacciones para mostrar.</p>
                )}
                <div className="confirmation-dialog-buttons">
                    <button onClick={onClose} className="btn-cancel" style={{flex: '0'}}>Cerrar</button>
                </div>
            </div>
        </div>
    );
};

const IncomeBreakdownModal = ({ isOpen, onClose, total, cardTotal, cashTotal, formatCurrency }: {
    isOpen: boolean;
    onClose: () => void;
    total: number;
    cardTotal: number;
    cashTotal: number;
    formatCurrency: (value: number) => string;
}) => {
    if (!isOpen) return null;

    return (
        <div className="transaction-detail-modal-overlay" onClick={onClose}>
            <div className="transaction-detail-modal" onClick={(e) => e.stopPropagation()}>
                <h2>Ingresos de este Mes</h2>
                <div className="income-breakdown-content">
                    <div className="breakdown-row total">
                        <span className="breakdown-label">Total Ingresado:</span>
                        <span className="breakdown-amount income-amount">{formatCurrency(total)}</span>
                    </div>
                    <hr className="balance-divider" />
                    <div className="breakdown-row">
                        <span className="breakdown-label">Por Tarjeta:</span>
                        <span className="breakdown-amount summary-amount-blue">{formatCurrency(cardTotal)}</span>
                    </div>
                    <div className="breakdown-row">
                        <span className="breakdown-label">En Efectivo:</span>
                        <span className="breakdown-amount summary-amount-green">{formatCurrency(cashTotal)}</span>
                    </div>
                </div>
                <div className="confirmation-dialog-buttons">
                    <button onClick={onClose} className="btn-cancel" style={{flex: '0'}}>Cerrar</button>
                </div>
            </div>
        </div>
    );
};

const ExpenseBreakdownModal = ({ isOpen, onClose, total, cardTotal, cashTotal, formatCurrency }: {
    isOpen: boolean;
    onClose: () => void;
    total: number;
    cardTotal: number;
    cashTotal: number;
    formatCurrency: (value: number) => string;
}) => {
    if (!isOpen) return null;

    return (
        <div className="transaction-detail-modal-overlay" onClick={onClose}>
            <div className="transaction-detail-modal" onClick={(e) => e.stopPropagation()}>
                <h2>Gastos de este Mes</h2>
                <div className="income-breakdown-content">
                    <div className="breakdown-row total">
                        <span className="breakdown-label">Total Gastado:</span>
                        <span className="breakdown-amount expense-amount">{formatCurrency(total)}</span>
                    </div>
                    <hr className="balance-divider" />
                    <div className="breakdown-row">
                        <span className="breakdown-label">Por Tarjeta:</span>
                        <span className="breakdown-amount summary-amount-blue">{formatCurrency(cardTotal)}</span>
                    </div>
                    <div className="breakdown-row">
                        <span className="breakdown-label">En Efectivo:</span>
                        <span className="breakdown-amount summary-amount-green">{formatCurrency(cashTotal)}</span>
                    </div>
                </div>
                <div className="confirmation-dialog-buttons">
                    <button onClick={onClose} className="btn-cancel" style={{flex: '0'}}>Cerrar</button>
                </div>
            </div>
        </div>
    );
};

// --- APP COMPONENT ---
const App: React.FC = () => {
  const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.API_KEY }), []);
  const [view, setView] = useState<'welcome' | 'expenses' | 'income' | 'summary' | 'settings'>('welcome');

  // Country State
  const DEFAULT_COUNTRIES: Country[] = [
    { code: 'ES', name: 'Espana', currency: 'EUR', locale: 'es-ES', flag: '🇪🇸' },
    { code: 'CO', name: 'Colombia', currency: 'COP', locale: 'es-CO', flag: '🇨🇴' },
  ];
  const [countries, setCountries] = useState<Country[]>([]);
  const [country, setCountry] = useState<string | null>(null);
  const [isAddCountryModalOpen, setIsAddCountryModalOpen] = useState(false);
  const [countryToDelete, setCountryToDelete] = useState<Country | null>(null);
  const [isGeneratingCountry, setIsGeneratingCountry] = useState(false);

  const [theme, setTheme] = useState('dark');
  const incomeAmountInputRef = useRef<HTMLInputElement>(null);
  const expenseAmountInputRef = useRef<HTMLInputElement>(null);

  const getToday = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  // Expenses State
  const [expenses, setExpenses] = useState<Transaction[]>([]);
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(getToday());
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<'card' | 'cash'>('card');
  const [expenseError, setExpenseError] = useState('');
  const [isExpenseFormExpanded, setIsExpenseFormExpanded] = useState(false);
  const [expenseSelectedBank, setExpenseSelectedBank] = useState<string | null>(null);
  const [expenseCategory, setExpenseCategory] = useState('');

  // Incomes State
  const [incomes, setIncomes] = useState<Transaction[]>([]);
  const [incomeDescription, setIncomeDescription] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeDate, setIncomeDate] = useState(getToday());
  const [incomePaymentMethod, setIncomePaymentMethod] = useState<'card' | 'cash'>('card');
  const [transactionToDelete, setTransactionToDelete] = useState<RenderableTransaction | null>(null);
  const [isIncomeFormExpanded, setIsIncomeFormExpanded] = useState(false);
  
  // Bank State
  const [banks, setBanks] = useState<Bank[]>([{ name: 'BBVA', color: '#004481' }]);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [bankToDelete, setBankToDelete] = useState<Bank | null>(null);
  const [bankToEdit, setBankToEdit] = useState<Bank | null>(null);
  const [bankModalContext, setBankModalContext] = useState<'income' | 'expense' | null>(null);
  
  // Category State
  const DEFAULT_CATEGORIES: Category[] = useMemo(() => [
    { name: 'Food', icon: 'Food' },
    { name: 'Transport', icon: 'Transport' },
    { name: 'Shopping', icon: 'Shopping' },
    { name: 'Bills', icon: 'Bills' },
    { name: 'Entertainment', icon: 'Entertainment' },
    { name: 'Health', icon: 'Health' },
    { name: 'General', icon: 'CreditCard' },
  ], []);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [categoryModalContext, setCategoryModalContext] = useState<'expense' | 'settings' | 'fixedExpense' | null>(null);
  const [categorySetterForFixedExpense, setCategorySetterForFixedExpense] = useState<((name: string) => void) | null>(null);
  
  // Fixed Expenses State
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [fixedExpenseModalContext, setFixedExpenseModalContext] = useState<'manage' | 'select' | null>(null);

  // Transfer Modals State
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [withdrawSourceBank, setWithdrawSourceBank] = useState<string | null>(null);

  // Summary Detail Modal State
  const [transactionModalDetails, setTransactionModalDetails] = useState<{
    isOpen: boolean;
    title: string;
    transactions: CombinedTransaction[];
  }>({ isOpen: false, title: '', transactions: [] });
  const [isIncomeBreakdownModalOpen, setIsIncomeBreakdownModalOpen] = useState(false);
  const [isExpenseBreakdownModalOpen, setIsExpenseBreakdownModalOpen] = useState(false);

  // History Validation Logic
  const isHistoryValid = useMemo(() => (
    futureIncomes: Transaction[],
    futureExpenses: Transaction[],
  ): boolean => {
    const all = [
      ...futureIncomes.map(t => ({ ...t, type: 'income' as const })),
      ...futureExpenses.map(t => ({ ...t, type: 'expense' as const }))
    ];

    all.sort((a, b) => {
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return a.id - b.id;
    });
    
    const balances: { [key: string]: number } = { cash: 0 };
    banks.forEach(bank => {
        balances[bank.name] = 0;
    });

    for (const transaction of all) {
      if (transaction.type === 'income') {
        if (transaction.paymentMethod === 'card' && transaction.bank) {
          balances[transaction.bank] = (balances[transaction.bank] || 0) + transaction.amount;
        } else {
          balances.cash += transaction.amount;
        }
      } else { // expense
        if (transaction.paymentMethod === 'card' && transaction.bank) {
          balances[transaction.bank] = (balances[transaction.bank] || 0) - transaction.amount;
          if (balances[transaction.bank] < -0.001) return false;
        } else {
          balances.cash -= transaction.amount;
          if (balances.cash < -0.001) return false;
        }
      }
    }
    return true;
  }, [banks]);


  // Load theme, persisted country, and custom countries on initial mount
  useEffect(() => {
    try {
      const storedCountries = localStorage.getItem('countries');
      setCountries(storedCountries ? JSON.parse(storedCountries) : DEFAULT_COUNTRIES);

      const storedCountry = localStorage.getItem('country');
      if (storedCountry) {
        setCountry(storedCountry);
        setView('summary');
      }
      const storedTheme = localStorage.getItem('theme');
      if (storedTheme) setTheme(storedTheme);
    } catch (error) {
      console.error("Failed to parse initial data from localStorage", error);
      setCountries(DEFAULT_COUNTRIES);
    }
  }, []);

  // Load country-specific data when country changes
  useEffect(() => {
    if (!country) return;

    try {
      const storedExpenses = localStorage.getItem(`expenses_${country}`);
      setExpenses(storedExpenses ? JSON.parse(storedExpenses) : []);

      const storedIncomes = localStorage.getItem(`incomes_${country}`);
      setIncomes(storedIncomes ? JSON.parse(storedIncomes) : []);

      const storedFixedExpenses = localStorage.getItem(`fixedExpenses_${country}`);
      setFixedExpenses(storedFixedExpenses ? JSON.parse(storedFixedExpenses) : []);

      const storedCategories = localStorage.getItem(`categories_${country}`);
      if (storedCategories) {
          const parsed = JSON.parse(storedCategories);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].name && parsed[0].icon) {
              setCategories(parsed);
          } else {
              setCategories(DEFAULT_CATEGORIES);
          }
      } else {
          setCategories(DEFAULT_CATEGORIES);
      }

      const storedBanks = localStorage.getItem(`banks_${country}`);
      if (storedBanks) {
        const parsedBanks = JSON.parse(storedBanks);
        if (Array.isArray(parsedBanks) && parsedBanks.length > 0) {
            if (typeof parsedBanks[0] === 'string') {
                const defaultColors = ['#424242', '#004481', '#4CAF50', '#2196F3', '#f44336', '#9c27b0', '#ff9800'];
                const migratedBanks: Bank[] = parsedBanks.map((bankName: string, index: number) => ({
                    name: bankName,
                    color: defaultColors[index % defaultColors.length]
                }));
                setBanks(migratedBanks);
            } else if (typeof parsedBanks[0] === 'object' && parsedBanks[0] !== null && 'name' in parsedBanks[0]) {
                setBanks(parsedBanks);
            }
        } else {
             setBanks([{ name: 'BBVA', color: '#004481' }]);
        }
      } else {
        setBanks([{ name: 'BBVA', color: '#004481' }]);
      }
    } catch (error) {
      console.error(`Failed to parse data from localStorage for country ${country}`, error);
    }
  }, [country, DEFAULT_CATEGORIES]);

  // Save country-specific data to localStorage
  useEffect(() => { if (country) localStorage.setItem(`expenses_${country}`, JSON.stringify(expenses)); }, [expenses, country]);
  useEffect(() => { if (country) localStorage.setItem(`incomes_${country}`, JSON.stringify(incomes)); }, [incomes, country]);
  useEffect(() => { if (country) localStorage.setItem(`fixedExpenses_${country}`, JSON.stringify(fixedExpenses)); }, [fixedExpenses, country]);
  useEffect(() => { if (country) localStorage.setItem(`banks_${country}`, JSON.stringify(banks)); }, [banks, country]);
  useEffect(() => { if (country) localStorage.setItem(`categories_${country}`, JSON.stringify(categories)); }, [categories, country]);
  
  // Save global settings
  useEffect(() => { if (country) localStorage.setItem('country', country); }, [country]);
  useEffect(() => {
      localStorage.setItem('countries', JSON.stringify(countries));
  }, [countries]);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  useEffect(() => {
    if (view !== 'income') {
      setIsIncomeFormExpanded(false);
      setSelectedBank(null);
    }
    if (view !== 'expenses') {
        setIsExpenseFormExpanded(false);
        setExpenseSelectedBank(null);
        setExpenseCategory('');
    }
  }, [view]);

  useEffect(() => {
    if (view === 'income') {
      const isCardReadyAndSelected = incomePaymentMethod === 'card' && selectedBank;
      const isCashSelected = incomePaymentMethod === 'cash';

      if (isCardReadyAndSelected || isCashSelected) {
        const timer = setTimeout(() => {
          incomeAmountInputRef.current?.focus();
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [view, selectedBank, incomePaymentMethod]);

  useEffect(() => {
    if (view === 'expenses') {
      const isCardReadyAndSelected = expensePaymentMethod === 'card' && expenseSelectedBank;
      const isCashSelected = expensePaymentMethod === 'cash' && isExpenseFormExpanded;

      if (isCardReadyAndSelected || isCashSelected) {
        const timer = setTimeout(() => {
          expenseAmountInputRef.current?.focus();
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [view, expenseSelectedBank, expensePaymentMethod, isExpenseFormExpanded]);

  const firstIncomeDate = useMemo(() => {
    if (incomes.length === 0) return null;
    const sortedIncomes = [...incomes].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return sortedIncomes[0].date;
  }, [incomes]);
  

  // Expense Handlers
  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNumber = parseFloat(expenseAmount);
    if (!expenseDescription.trim() || isNaN(amountNumber) || amountNumber <= 0 || !expenseDate || expenseError) return;
    if (expensePaymentMethod === 'card' && !expenseSelectedBank) return;

    const newExpense: Transaction = {
        id: Date.now(),
        description: expenseDescription.trim(),
        amount: amountNumber,
        date: expenseDate,
        paymentMethod: expensePaymentMethod,
        category: expenseCategory || 'General',
        ...(expensePaymentMethod === 'card' && expenseSelectedBank && { bank: expenseSelectedBank })
    };
    setExpenses(prev => [...prev, newExpense].sort(transactionSorter));
    
    // Reset form
    setExpenseCategory('');
    setExpenseDescription('');
    setExpenseAmount('');
    setExpenseDate(getToday());
    setExpensePaymentMethod('card');
    setIsExpenseFormExpanded(false);
    setExpenseSelectedBank(null);
  };
  
  const handleExpensePaymentToggle = (method: 'card' | 'cash') => {
    setIsExpenseFormExpanded(true);
    if (method === 'card') {
      const banksWithFunds = banks.filter(bank => (bankBalances[bank.name] || 0) > 0);
      if (banksWithFunds.length === 0) {
        alert("No tienes fondos en ninguna cuenta de banco para realizar un gasto con tarjeta.");
        return; 
      }
    }
    setExpensePaymentMethod(method);

    if (method === 'card') {
        setBankModalContext('expense');
        setIsBankModalOpen(true);
    } else {
        setExpenseSelectedBank(null);
    }
  };

  // Income Handlers
  const handleAddIncome = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNumber = parseFloat(incomeAmount);
    if (!incomeDescription.trim() || isNaN(amountNumber) || amountNumber <= 0 || !incomeDate) return;
    const newIncome: Transaction = { 
        id: Date.now(),
        description: incomeDescription.trim(),
        amount: amountNumber, date: incomeDate,
        paymentMethod: incomePaymentMethod,
        ...(incomePaymentMethod === 'card' && selectedBank && { bank: selectedBank })
    };
    setIncomes(prev => [...prev, newIncome].sort(transactionSorter));
    setIncomeDescription('');
    setIncomeAmount('');
    setIncomeDate(getToday());
    setIncomePaymentMethod('card');
    setIsIncomeFormExpanded(false);
    setSelectedBank(null);
  };
  
  const handleIncomePaymentToggle = (method: 'card' | 'cash') => {
    setIsIncomeFormExpanded(true);
    setIncomePaymentMethod(method);
  
    if (method === 'card') {
      setBankModalContext('income');
      setIsBankModalOpen(true);
    } else { 
      setSelectedBank(null);
    }
  };

  // Category Handlers
  const handleAddCategory = (newCategory: Category) => {
    setCategories(prev => [...prev, newCategory]);
  };

  const handleUpdateCategory = (oldName: string, updatedCategory: Category) => {
    setCategories(prev => prev.map(c => c.name === oldName ? updatedCategory : c));
    if (oldName !== updatedCategory.name) {
      setExpenses(prev => prev.map(e => e.category === oldName ? { ...e, category: updatedCategory.name } : e));
    }
  };

  const handleDeleteCategory = (categoryName: string) => {
    setCategories(prev => prev.filter(c => c.name !== categoryName));
  };

  // Fixed Expense Handlers
  const handleAddFixedExpense = (newFe: Omit<FixedExpense, 'id'>) => {
      setFixedExpenses(prev => [...prev, { ...newFe, id: Date.now() }].sort((a,b) => a.description.localeCompare(b.description)));
  };
  const handleUpdateFixedExpense = (updatedFe: FixedExpense) => {
      setFixedExpenses(prev => prev.map(fe => fe.id === updatedFe.id ? updatedFe : fe).sort((a,b) => a.description.localeCompare(b.description)));
  };
  const handleDeleteFixedExpense = (id: number) => {
      setFixedExpenses(prev => prev.filter(fe => fe.id !== id));
  };
  const handleSelectFixedExpense = (fe: FixedExpense) => {
    const amountNumber = fe.amount;

    // Validation: cannot add if payment method isn't fully selected
    if (expensePaymentMethod === 'card' && !expenseSelectedBank) {
      alert("Por favor, selecciona un banco antes de anadir un gasto fijo con tarjeta.");
      setFixedExpenseModalContext(null); // Close modal
      return;
    }

    // Validation: check for future negative balance
    const tempExpenseForValidation: Transaction = {
        id: Date.now() + 1,
        description: fe.description,
        amount: amountNumber,
        date: expenseDate, // Use the date from the form
        paymentMethod: expensePaymentMethod,
        ...(expensePaymentMethod === 'card' && expenseSelectedBank && { bank: expenseSelectedBank })
    };
    if (!isHistoryValid(incomes, [...expenses, tempExpenseForValidation])) {
        alert("No se puede anadir este gasto fijo porque resultaria en un saldo negativo.");
        setFixedExpenseModalContext(null); // Close modal
        return;
    }

    // Create the new expense transaction
    const newExpense: Transaction = {
        id: Date.now(),
        description: fe.description,
        amount: amountNumber,
        date: expenseDate,
        paymentMethod: expensePaymentMethod,
        category: fe.category,
        fixedExpenseId: fe.id,
        ...(expensePaymentMethod === 'card' && expenseSelectedBank && { bank: expenseSelectedBank })
    };
    
    // Add expense to state
    setExpenses(prev => [...prev, newExpense].sort(transactionSorter));
    
    // Reset form for a new entry
    setExpenseCategory('');
    setExpenseDescription('');
    setExpenseAmount('');
    setExpenseDate(getToday());
    setExpensePaymentMethod('card');
    setIsExpenseFormExpanded(false);
    setExpenseSelectedBank(null);

    // Close the modal
    setFixedExpenseModalContext(null);
  };

  const handleWithdraw = (bankName: string, amount: number, date: string) => {
    const withdrawalDate = date;
    const now = Date.now();
    const transferId = now;

    const expenseTransfer: Transaction = {
        id: now,
        description: 'Transferencia entre cuentas',
        amount: amount,
        date: withdrawalDate,
        paymentMethod: 'card',
        bank: bankName,
        isTransfer: true,
        transferId: transferId
    };
    
    const incomeTransfer: Transaction = {
        id: now + 1, // Ensure unique id
        description: 'Transferencia entre cuentas',
        amount: amount,
        date: withdrawalDate,
        paymentMethod: 'cash',
        isTransfer: true,
        transferId: transferId
    };
    
    setExpenses(prev => [...prev, expenseTransfer].sort(transactionSorter));
    setIncomes(prev => [...prev, incomeTransfer].sort(transactionSorter));
    setIsWithdrawModalOpen(false);
  };

  const handleDeposit = (bankName: string, amount: number, date: string) => {
    const depositDate = date;
    const now = Date.now();
    const transferId = now;

    const expenseTransfer: Transaction = {
        id: now,
        description: 'Transferencia entre cuentas',
        amount: amount,
        date: depositDate,
        paymentMethod: 'cash',
        isTransfer: true,
        transferId: transferId,
    };
    
    const incomeTransfer: Transaction = {
        id: now + 1, // Ensure unique id
        description: 'Transferencia entre cuentas',
        amount: amount,
        date: depositDate,
        paymentMethod: 'card',
        bank: bankName,
        isTransfer: true,
        transferId: transferId,
    };
    
    setExpenses(prev => [...prev, expenseTransfer].sort(transactionSorter));
    setIncomes(prev => [...prev, incomeTransfer].sort(transactionSorter));
    setIsDepositModalOpen(false);
  };

  const handleBankAdded = (newBankName: string, newBankColor: string) => {
    if (newBankName && !banks.some(b => b.name.toLowerCase() === newBankName.toLowerCase())) {
        const newBank: Bank = { name: newBankName, color: newBankColor };
        setBanks([...banks, newBank]);
    }
  };

  const handleBankSelected = (bank: Bank) => {
    if (bankModalContext === 'income') {
        setSelectedBank(bank.name);
        setIsIncomeFormExpanded(true);
    } else if (bankModalContext === 'expense') {
        setExpenseSelectedBank(bank.name);
    }
    setIsBankModalOpen(false);
    setBankModalContext(null);
  }

  const confirmDeleteBank = () => {
    if (!bankToDelete) return;
    const isBankInUse = incomes.some(income => income.bank === bankToDelete.name) || expenses.some(expense => expense.bank === bankToDelete.name);
    if (isBankInUse) {
        alert(`No se puede eliminar el banco "${bankToDelete.name}" porque esta siendo utilizado.`);
        setBankToDelete(null);
        setIsBankModalOpen(true);
        return;
    }
    setBanks(banks.filter(b => b.name !== bankToDelete.name));
    setBankToDelete(null);
  };

  const cancelDeleteBank = () => {
    setBankToDelete(null);
    setIsBankModalOpen(true);
  };

  const handleDeleteBankRequest = (bank: Bank) => {
    setIsBankModalOpen(false);
    setBankToDelete(bank);
  };

  const handleEditBankRequest = (bank: Bank) => {
    setIsBankModalOpen(false);
    setBankToEdit(bank);
  };

  const handleUpdateBank = (oldName: string, newBank: Bank) => {
    if (!newBank.name.trim()) {
        alert("El nombre del banco no puede estar vacio.");
        return;
    }
    if (banks.some(b => b.name.toLowerCase() === newBank.name.toLowerCase() && b.name.toLowerCase() !== oldName.toLowerCase())) {
        alert(`El nombre del banco "${newBank.name}" ya existe.`);
        return;
    }
    setBanks(banks.map(b => (b.name === oldName ? newBank : b)));
    if (oldName !== newBank.name) {
        setIncomes(incomes.map(income => income.bank === oldName ? { ...income, bank: newBank.name } : income));
        setExpenses(expenses.map(expense => expense.bank === oldName ? { ...expense, bank: newBank.name } : expense));
    }
    setBankToEdit(null);
    setIsBankModalOpen(true);
  };

  const handleDeleteTransaction = (transaction: RenderableTransaction) => {
    setTransactionToDelete(transaction);
  };
  
  const confirmDeleteTransaction = () => {
    if (!transactionToDelete) return;

    let nextIncomes = [...incomes];
    let nextExpenses = [...expenses];

    if (transactionToDelete.type === 'transfer') {
        const { transferId } = transactionToDelete;
        nextIncomes = incomes.filter(t => t.transferId !== transferId);
        nextExpenses = expenses.filter(t => t.transferId !== transferId);
    } else { // 'income' or 'expense'
        const { id, type } = transactionToDelete;
        if (type === 'income') {
            nextIncomes = incomes.filter(income => income.id !== id);
        } else {
            nextExpenses = expenses.filter(expense => expense.id !== id);
        }
    }

    if (isHistoryValid(nextIncomes, nextExpenses)) {
        setIncomes(nextIncomes);
        setExpenses(nextExpenses);
    } else {
        alert("No se puede eliminar esta transaccion porque resultaria en un saldo negativo.");
    }

    setTransactionToDelete(null);
  };

  const cancelDeleteTransaction = () => {
    setTransactionToDelete(null);
  };
  
  const allTransactions = useMemo(() => {
    const regularTransactions: CombinedTransaction[] = [
      ...incomes.filter(t => !t.isTransfer).map(t => ({ ...t, type: 'income' as const })),
      ...expenses.filter(t => !t.isTransfer).map(t => ({ ...t, type: 'expense' as const }))
    ];

    const transfers: RenderableTransfer[] = [];
    for (const expenseSide of expenses) {
      if (!expenseSide.isTransfer || !expenseSide.transferId) continue;
      const incomeSide = incomes.find(t => t.transferId === expenseSide.transferId);
      if (incomeSide) {
        transfers.push({
          id: expenseSide.id,
          transferId: expenseSide.transferId,
          amount: expenseSide.amount,
          date: expenseSide.date,
          from: { method: expenseSide.paymentMethod, bank: expenseSide.bank },
          to: { method: incomeSide.paymentMethod, bank: incomeSide.bank },
          type: 'transfer',
          originalType: 'expense',
        });
      }
    }
    
    const combined: RenderableTransaction[] = [...regularTransactions, ...transfers];
    return combined.sort(transactionSorter);
  }, [incomes, expenses]);

  const incomeSummary = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const todayStr = getToday();

    const totals = { global: 0, esteMes: 0, hoy: 0, tarjeta: 0, efectivo: 0, tarjetaEsteMesBalance: 0, efectivoEsteMesBalance: 0, tarjetaEsteMesIngresos: 0, efectivoEsteMesIngresos: 0 };
    incomes.forEach(income => {
      if (income.paymentMethod === 'card') totals.tarjeta += income.amount;
      else totals.efectivo += income.amount;

      const incomeDate = new Date(income.date);
      incomeDate.setMinutes(incomeDate.getMinutes() + incomeDate.getTimezoneOffset());
      const isThisMonth = incomeDate.getFullYear() === currentYear && incomeDate.getMonth() === currentMonth;

      if (isThisMonth) {
        if (income.paymentMethod === 'card') totals.tarjetaEsteMesBalance += income.amount;
        else totals.efectivoEsteMesBalance += income.amount;
      }
      if (!income.isTransfer) {
        totals.global += income.amount;
        if (isThisMonth) {
          totals.esteMes += income.amount;
          if (income.paymentMethod === 'card') totals.tarjetaEsteMesIngresos += income.amount;
          else totals.efectivoEsteMesIngresos += income.amount;
        }
        if (income.date === todayStr) totals.hoy += income.amount;
      }
    });
    return totals;
  }, [incomes]);

  const expenseSummary = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const todayStr = getToday();

    const totals = { global: 0, esteMes: 0, hoy: 0, tarjeta: 0, efectivo: 0, tarjetaEsteMesBalance: 0, efectivoEsteMesBalance: 0, tarjetaEsteMesGastos: 0, efectivoEsteMesGastos: 0 };
    expenses.forEach(expense => {
        if (expense.paymentMethod === 'card') totals.tarjeta += expense.amount;
        else totals.efectivo += expense.amount;

        const expenseDateObj = new Date(expense.date);
        expenseDateObj.setMinutes(expenseDateObj.getMinutes() + expenseDateObj.getTimezoneOffset());
        const isThisMonth = expenseDateObj.getFullYear() === currentYear && expenseDateObj.getMonth() === currentMonth;

        if (isThisMonth) {
            if (expense.paymentMethod === 'card') totals.tarjetaEsteMesBalance += expense.amount;
            else totals.efectivoEsteMesBalance += expense.amount;
        }
        if (!expense.isTransfer) {
          totals.global += expense.amount;
          if (isThisMonth) {
              totals.esteMes += expense.amount;
              if (expense.paymentMethod === 'card') totals.tarjetaEsteMesGastos += expense.amount;
              else totals.efectivoEsteMesGastos += expense.amount;
          }
          if (expense.date === todayStr) totals.hoy += expense.amount;
        }
    });
    return totals;
  }, [expenses]);

  const chronologicalBalances = useMemo(() => {
    const all = [
      ...incomes.map(t => ({ ...t, type: 'income' as const })),
      ...expenses.map(t => ({ ...t, type: 'expense' as const }))
    ];

    all.sort((a, b) => {
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return a.id - b.id;
    });

    const bankBalances: { [key: string]: number } = {};
    banks.forEach(bank => { bankBalances[bank.name] = 0; });
    let cashBalance = 0;

    for (const transaction of all) {
        if (transaction.type === 'income') {
            if (transaction.paymentMethod === 'card' && transaction.bank) bankBalances[transaction.bank] = (bankBalances[transaction.bank] || 0) + transaction.amount;
            else cashBalance += transaction.amount;
        } else { // expense
            if (transaction.paymentMethod === 'card' && transaction.bank) bankBalances[transaction.bank] = (bankBalances[transaction.bank] || 0) - transaction.amount;
            else cashBalance -= transaction.amount;
        }
    }
    const cardTotal = Object.values(bankBalances).reduce((sum, val) => sum + val, 0);
    return { bankBalances: bankBalances, cash: cashBalance, card: cardTotal };
  }, [incomes, expenses, banks]);

  const bankBalances = chronologicalBalances.bankBalances;
  const availableBalance = { card: chronologicalBalances.card, cash: chronologicalBalances.cash };
  const banksWithFunds = useMemo(() => banks.filter(bank => (bankBalances[bank.name] || 0) > 0), [banks, bankBalances]);

  // Currency Formatter
  const formatCurrency = useCallback((value: number, overrideCountryCode?: string | null) => {
    const targetCode = overrideCountryCode || country;
    const countryConfig = countries.find(c => c.code === targetCode);
    
    const locale = countryConfig ? countryConfig.locale : 'en-US';
    const currency = countryConfig ? countryConfig.currency : 'USD';
    
    const options: Intl.NumberFormatOptions = { style: 'currency', currency };
    if (Math.abs(value) < 100) {
      options.minimumFractionDigits = 2;
      options.maximumFractionDigits = 2;
    } else {
      options.minimumFractionDigits = 0;
      options.maximumFractionDigits = 0;
    }
    return new Intl.NumberFormat(locale, options).format(value);
  }, [country, countries]);

  useEffect(() => {
    if (firstIncomeDate && expenseDate < firstIncomeDate) {
        setExpenseError(`El gasto no puede ser anterior al primer ingreso.`);
        return;
    }
    const amount = parseFloat(expenseAmount);
    if (!isNaN(amount) && amount > 0) {
        const tempExpense: Transaction = {
            id: Date.now() + 1,
            description: 'temporary validation expense',
            amount: amount,
            date: expenseDate,
            paymentMethod: expensePaymentMethod,
            ...(expensePaymentMethod === 'card' && expenseSelectedBank && { bank: expenseSelectedBank })
        };
        if (!isHistoryValid(incomes, [...expenses, tempExpense])) {
            setExpenseError(`Este gasto resultaria en un saldo negativo.`);
            return;
        }
    }
    setExpenseError('');
  }, [expenseAmount, expenseDate, expensePaymentMethod, expenseSelectedBank, incomes, expenses, firstIncomeDate, isHistoryValid]);

  const handleBankClickWithdraw = (bankName: string) => {
    setWithdrawSourceBank(bankName);
    setIsWithdrawModalOpen(true);
  };

  const handleShowMonthlyDetail = (type: 'income' | 'expense') => {
    if (type === 'income') {
        setIsIncomeBreakdownModalOpen(true);
    } else if (type === 'expense') {
        setIsExpenseBreakdownModalOpen(true);
    }
  };
  
  const handleGoToWelcome = () => {
    localStorage.removeItem('country');
    setCountry(null);
    
    // Reset all data states to their initial values
    setExpenses([]);
    setIncomes([]);
    setBanks([{ name: 'BBVA', color: '#004481' }]);
    setCategories(DEFAULT_CATEGORIES);
    setFixedExpenses([]);
    
    // Reset form states
    setExpenseDescription('');
    setExpenseAmount('');
    setExpenseDate(getToday());
    setIncomeDescription('');
    setIncomeAmount('');
    setIncomeDate(getToday());

    setView('welcome');
  };

  const handleExportData = () => {
    const selectedCountry = countries.find(c => c.code === country);
    if (!selectedCountry) {
        alert("No se ha seleccionado un pais.");
        return;
    }

    const csvRows = [];
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const formatCsvField = (field: any): string => {
        const stringField = String(field ?? '').trim();
        // Escape quotes and wrap in quotes if it contains a comma, newline, or quote
        if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
            return `"${stringField.replace(/"/g, '""')}"`;
        }
        return stringField;
    };

    const joinRow = (rowArray: any[]) => rowArray.map(formatCsvField).join(',');

    // Section 1: Report Information
    csvRows.push(joinRow(['Informe Financiero', selectedCountry.name]));
    csvRows.push(joinRow(['Fecha de Exportacion', today]));
    csvRows.push(''); // Spacer

    // Section 2: Balance Summary
    csvRows.push(joinRow(['Resumen de Saldos']));
    csvRows.push(joinRow(['Cuenta', 'Saldo']));
    csvRows.push(joinRow(['Saldo actual', (availableBalance.card + availableBalance.cash).toFixed(2)]));
    csvRows.push(joinRow(['Efectivo', availableBalance.cash.toFixed(2)]));
    banks.forEach(bank => {
        csvRows.push(joinRow([bank.name, (bankBalances[bank.name] || 0).toFixed(2)]));
    });
    csvRows.push('');

    // Section 3: Monthly Summary (Current Month)
    csvRows.push(joinRow(['Resumen Mensual (Mes Actual)']));
    csvRows.push(joinRow(['Concepto', 'Monto']));
    csvRows.push(joinRow(['Ingresos', incomeSummary.esteMes.toFixed(2)]));
    csvRows.push(joinRow(['Gastos', expenseSummary.esteMes.toFixed(2)]));
    csvRows.push('');
    
    // Section 4: Global Summary
    csvRows.push(joinRow(['Resumen Global (Historico)']));
    csvRows.push(joinRow(['Concepto', 'Monto']));
    csvRows.push(joinRow(['Ingresos Totales', incomeSummary.global.toFixed(2)]));
    csvRows.push(joinRow(['Gastos Totales', expenseSummary.global.toFixed(2)]));
    csvRows.push('');

    // Section 5: Transaction History
    csvRows.push(joinRow(['Historial de Transacciones']));
    const headers = [
        'Fecha',
        'Tipo',
        'Descripcion',
        'Monto',
        'Metodo de Pago',
        'Cuenta Origen',
        'Cuenta Destino',
        'Categoria'
    ];
    csvRows.push(joinRow(headers));

    allTransactions.forEach(t => {
        const row: (string | number)[] = [];
        const transactionDate = t.date; // Date is already YYYY-MM-DD

        if (t.type === 'transfer') {
            const fromText = t.from.method === 'card' && t.from.bank ? t.from.bank : 'Efectivo';
            const toText = t.to.method === 'card' && t.to.bank ? t.to.bank : 'Efectivo';
            row.push(
                transactionDate,
                'Transferencia',
                'Transferencia entre cuentas',
                t.amount.toFixed(2),
                'Transferencia',
                fromText,
                toText,
                ''
            );
        } else {
            const amount = t.type === 'income' ? t.amount : -t.amount;
            let origin = '';
            let destination = '';

            if (t.type === 'income') {
                destination = t.paymentMethod === 'card' ? (t.bank || 'Tarjeta') : 'Efectivo';
            } else { // expense
                origin = t.paymentMethod === 'card' ? (t.bank || 'Tarjeta') : 'Efectivo';
            }

            row.push(
                transactionDate,
                t.type === 'income' ? 'Ingreso' : 'Gasto',
                t.description,
                amount.toFixed(2),
                t.paymentMethod === 'card' ? 'Tarjeta' : 'Efectivo',
                origin,
                destination,
                t.type === 'expense' ? (t.category || '') : ''
            );
        }
        csvRows.push(joinRow(row));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const dateForFilename = new Date().toISOString().slice(0, 10);
    link.setAttribute("download", `datos_financieros_${selectedCountry.code.toLowerCase()}_${dateForFilename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert('¡Datos exportados con exito!');
  };
  
  const BalanceSummary = ({ availableBalance, banks, bankBalances, formatCurrency, onBankClick, onCashClick }: { availableBalance: { card: number, cash: number }, banks: Bank[], bankBalances: { [key: string]: number }, formatCurrency: (value: number) => string, onBankClick?: (bankName: string) => void, onCashClick?: () => void }) => {
    return (
      <div className="balance-summary-container">
        <div className="balance-highlight">
          <span className="balance-label">Saldo actual</span>
          <span className="balance-amount total-balance">
            <AnimatedNumber value={availableBalance.card + availableBalance.cash} formatCurrency={formatCurrency} />
          </span>
        </div>
        <div className="balance-details">
            <div className={`balance-item ${onCashClick ? 'clickable' : ''}`} onClick={onCashClick}>
              <span className="bank-color-dot" style={{ backgroundColor: 'var(--cash-green)' }}></span>
              <span className="balance-label">Efectivo:</span>
              <span className="balance-amount income-amount"><AnimatedNumber value={availableBalance.cash} formatCurrency={formatCurrency} /></span>
            </div>
    
            {banks.length > 0 && <hr className="balance-divider" />}
    
            {banks.map(bank => {
                const hasFunds = (bankBalances[bank.name] || 0) > 0.001;
                const isClickable = onBankClick && hasFunds;
                return (
                  <div className={`balance-item ${isClickable ? 'clickable' : ''}`} key={bank.name} onClick={() => isClickable && onBankClick(bank.name)} aria-disabled={!isClickable}>
                    <span className="bank-color-dot" style={{ backgroundColor: bank.color }}></span>
                    <span className="balance-label">{bank.name}:</span>
                    <span className="balance-amount summary-amount-card"><AnimatedNumber value={bankBalances[bank.name] || 0} formatCurrency={formatCurrency} /></span>
                  </div>
                );
            })}
        </div>
      </div>
    );
  };
  
  const ConfirmationDialog = ({ message, onConfirm, onCancel }: { message: string, onConfirm: () => void, onCancel: () => void }) => (
    <div className="confirmation-dialog-overlay">
      <div className="confirmation-dialog">
        <p>{message}</p>
        <div className="confirmation-dialog-buttons">
          <button onClick={onCancel} className="btn-cancel">Cancelar</button>
          <button onClick={onConfirm} className="btn-confirm">Eliminar</button>
        </div>
      </div>
    </div>
  );
  
  const BankSelectionModal = ({ banks, onSelect, onAddBank, onClose, onDeleteBank, onEditBank, bankBalances, formatCurrency }: { banks: Bank[], onSelect: (bank: Bank) => void, onAddBank: (name: string, color: string) => void, onClose: () => void, onDeleteBank: (bank: Bank) => void, onEditBank: (bank: Bank) => void, bankBalances?: { [key: string]: number }, formatCurrency?: (value: number) => string }) => {
    const [newBankName, setNewBankName] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [newBankColor, setNewBankColor] = useState('#424242');
    const [newBankHsl, setNewBankHsl] = useState<[number, number, number]>([0, 0, 26]);

    useEffect(() => {
        if (isAdding) setNewBankColor(hslToHex(newBankHsl[0], newBankHsl[1], newBankHsl[2]));
    }, [newBankHsl, isAdding]);

    const handleShowAddForm = () => {
        const defaultColors = ['#4CAF50', '#2196F3', '#f44336', '#9c27b0', '#ff9800', '#004481', '#424242'];
        const nextColor = defaultColors[banks.length % defaultColors.length];
        const nextHsl = hexToHsl(nextColor) || [150, 50, 50];
        setNewBankColor(nextColor);
        setNewBankHsl(nextHsl);
        setIsAdding(true);
    };

    const handleAddClick = () => {
        if (newBankName.trim()) {
            onAddBank(newBankName.trim(), newBankColor);
            setNewBankName('');
            setIsAdding(false);
        }
    };

    const hue = newBankHsl[0], saturation = newBankHsl[1], lightness = newBankHsl[2];
    const saturationGradient = `linear-gradient(to right, hsl(${hue}, 0%, ${lightness}%), hsl(${hue}, 100%, ${lightness}%))`;
    const lightnessGradient = `linear-gradient(to right, hsl(${hue}, ${saturation}%, 0%), hsl(${hue}, ${saturation}%, 50%), hsl(${hue}, ${saturation}%, 100%))`;
    
    return (
        <div className="bank-modal-overlay" onClick={onClose}>
            <div className="bank-modal" onClick={(e) => e.stopPropagation()}>
                <h2>Selecciona un Banco</h2>
                <div className="bank-list">
                    {banks.map(bank => (
                       <div key={bank.name} className="bank-item" style={{'--bank-color': bank.color} as React.CSSProperties}>
                            <button className="bank-action-btn" aria-label={`Editar banco ${bank.name}`} onClick={() => onEditBank(bank)}><PencilIcon /></button>
                            <div className="bank-name" onClick={() => onSelect(bank)}>
                                <span>{bank.name}</span>
                                {bankBalances && formatCurrency && bankBalances[bank.name] !== undefined && (
                                  <span className="bank-balance">{formatCurrency(bankBalances[bank.name])}</span>
                                )}
                            </div>
                             <button className="bank-action-btn" aria-label={`Eliminar banco ${bank.name}`} onClick={() => onDeleteBank(bank)}><TrashIcon /></button>
                        </div>
                    ))}
                </div>
                {isAdding ? (
                    <div className="add-bank-section">
                        <div className="form-group"><label htmlFor="new-bank-name">Nombre del Banco</label><input id="new-bank-name" type="text" value={newBankName} onChange={(e) => setNewBankName(e.target.value)} placeholder="Nombre del nuevo banco" autoFocus/></div>
                        <div className="form-group"><label>Color</label><div className="color-preview" style={{ backgroundColor: newBankColor }}><span className="hex-code">{newBankColor.toUpperCase()}</span></div></div>
                        <div className="color-sliders">
                            <div className="slider-group"><div className="slider-label"><span>Matiz</span><span>{hue}°</span></div><input type="range" min="0" max="360" value={hue} onChange={e => setNewBankHsl([parseInt(e.target.value), saturation, lightness])} className="hue-slider" /></div>
                            <div className="slider-group"><div className="slider-label"><span>Saturacion</span><span>{saturation}%</span></div><input type="range" min="0" max="100" value={saturation} onChange={e => setNewBankHsl([hue, parseInt(e.target.value), lightness])} style={{ background: saturationGradient }} /></div>
                            <div className="slider-group"><div className="slider-label"><span>Luminosidad</span><span>{lightness}%</span></div><input type="range" min="0" max="100" value={lightness} onChange={e => setNewBankHsl([hue, saturation, parseInt(e.target.value)])} style={{ background: lightnessGradient }} /></div>
                        </div>
                        <div className="confirmation-dialog-buttons"><button onClick={() => setIsAdding(false)} className="btn-cancel">Cancelar</button><button onClick={handleAddClick} className="btn-confirm-edit">Guardar</button></div>
                    </div>
                ) : (
                    <button onClick={handleShowAddForm} className="btn-show-add-bank"><PlusIcon /><span>Crear nuevo banco</span></button>
                )}
            </div>
        </div>
    );
  };
  
  const EditBankModal = ({ bank, onUpdateBank, onClose }: { bank: Bank, onUpdateBank: (oldName: string, newBank: Bank) => void, onClose: () => void }) => {
    const [name, setName] = useState(bank.name);
    const initialHsl = hexToHsl(bank.color) || [207, 75, 25];
    const [hsl, setHsl] = useState<[number, number, number]>(initialHsl);
    const [hexColor, setHexColor] = useState(bank.color);
    
    useEffect(() => { setHexColor(hslToHex(hsl[0], hsl[1], hsl[2])); }, [hsl]);

    const handleSave = () => { onUpdateBank(bank.name, { name: name.trim(), color: hexColor }); };

    const hue = hsl[0], saturation = hsl[1], lightness = hsl[2];
    const saturationGradient = `linear-gradient(to right, hsl(${hue}, 0%, ${lightness}%), hsl(${hue}, 100%, ${lightness}%))`;
    const lightnessGradient = `linear-gradient(to right, hsl(${hue}, ${saturation}%, 0%), hsl(${hue}, ${saturation}%, 50%), hsl(${hue}, ${saturation}%, 100%))`;

    return (
        <div className="edit-bank-modal-overlay" onClick={onClose}>
            <div className="edit-bank-modal" onClick={(e) => e.stopPropagation()}>
                <h2>Editar Banco</h2>
                <div className="edit-bank-form">
                    <div className="form-group"><label htmlFor="bank-name-edit">Nombre del Banco</label><input id="bank-name-edit" type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus/></div>
                    <div className="form-group"><label>Color</label><div className="color-preview" style={{ backgroundColor: hexColor }}><span className="hex-code">{hexColor.toUpperCase()}</span></div></div>
                    <div className="color-sliders">
                        <div className="slider-group"><div className="slider-label"><span>Matiz</span><span>{hue}°</span></div><input type="range" min="0" max="360" value={hue} onChange={e => setHsl([parseInt(e.target.value), saturation, lightness])} className="hue-slider" /></div>
                        <div className="slider-group"><div className="slider-label"><span>Saturacion</span><span>{saturation}%</span></div><input type="range" min="0" max="100" value={saturation} onChange={e => setHsl([hue, parseInt(e.target.value), lightness])} style={{ background: saturationGradient }} /></div>
                        <div className="slider-group"><div className="slider-label"><span>Luminosidad</span><span>{lightness}%</span></div><input type="range" min="0" max="100" value={lightness} onChange={e => setHsl([hue, saturation, parseInt(e.target.value)])} style={{ background: lightnessGradient }} /></div>
                    </div>
                    <div className="confirmation-dialog-buttons"><button onClick={onClose} className="btn-cancel">Cancelar</button><button onClick={handleSave} className="btn-confirm-edit">Guardar</button></div>
                </div>
            </div>
        </div>
    );
  };
  
  const WithdrawModal = ({ isOpen, onClose, onConfirm, banksWithFunds, bankBalances, formatCurrency, firstIncomeDate, incomes, expenses, isHistoryValid, initialBankName }: { isOpen: boolean, onClose: () => void, onConfirm: (bankName: string, amount: number, date: string) => void, banksWithFunds: Bank[], bankBalances: { [key: string]: number }, formatCurrency: (value: number) => string, firstIncomeDate: string | null, incomes: Transaction[], expenses: Transaction[], isHistoryValid: (i: Transaction[], e: Transaction[]) => boolean, initialBankName?: string | null }) => {
    const [selectedBank, setSelectedBank] = useState<string>('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(getToday());
    const [error, setError] = useState('');

    useEffect(() => {
        if (initialBankName && banksWithFunds.some(b => b.name === initialBankName)) setSelectedBank(initialBankName);
        else if (banksWithFunds.length > 0 && !selectedBank) setSelectedBank(banksWithFunds[0].name);
        else if (banksWithFunds.length === 0) setSelectedBank('');
    }, [banksWithFunds, selectedBank, initialBankName]);

    useEffect(() => {
        const numericAmount = parseFloat(amount);
        if (!amount || isNaN(numericAmount) || numericAmount <= 0) { setError(''); return; }
        if (!selectedBank) { setError('Por favor, selecciona un banco.'); return; }

        const expenseTransfer: Transaction = { id: Date.now(), description: 'Transferencia entre cuentas', amount: numericAmount, date: date, paymentMethod: 'card', bank: selectedBank, isTransfer: true, transferId: Date.now() };
        const incomeTransfer: Transaction = { id: Date.now() + 1, description: 'Transferencia entre cuentas', amount: numericAmount, date: date, paymentMethod: 'cash', isTransfer: true, transferId: Date.now() };
        
        if (!isHistoryValid([...incomes, incomeTransfer], [...expenses, expenseTransfer])) setError(`Este retiro resultaria en un saldo negativo.`);
        else setError('');
    }, [amount, selectedBank, date, incomes, expenses, isHistoryValid]);

    const selectedBankInfo = useMemo(() => {
        if (!selectedBank) return null;
        return banksWithFunds.find(b => b.name === selectedBank);
    }, [selectedBank, banksWithFunds]);

    const selectStyle: React.CSSProperties = {};
    if (selectedBankInfo) {
        selectStyle.backgroundColor = selectedBankInfo.color;
        const hsl = hexToHsl(selectedBankInfo.color);
        const textColor = (hsl && hsl[2] > 60) ? 'var(--bg-dark)' : 'var(--text-primary)';
        selectStyle.color = textColor;
        const arrowColor = encodeURIComponent(textColor === 'var(--bg-dark)' ? '#121212' : '#FFFFFF');
        selectStyle.backgroundImage = `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${arrowColor}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`;
    }

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (!error && selectedBank && amount) {
            onConfirm(selectedBank, parseFloat(amount), date);
            setSelectedBank(banksWithFunds.length > 0 ? banksWithFunds[0].name : '');
            setAmount(''); setDate(getToday()); setError('');
        }
    };
    
    const handleClose = () => {
        setSelectedBank(banksWithFunds.length > 0 ? banksWithFunds[0].name : '');
        setAmount(''); setDate(getToday()); setError(''); onClose();
    }

    return (
        <div className="edit-bank-modal-overlay" onClick={handleClose}>
            <div className="edit-bank-modal" onClick={(e) => e.stopPropagation()}>
                <h2>Retirar Dinero</h2>
                <div className="edit-bank-form">
                    <div className="form-group"><label htmlFor="withdraw-date">Fecha del Retiro</label><div className="date-picker-container"><div className="date-picker-display" aria-hidden="true">{formatDate(date)}</div><input type="date" id="withdraw-date" value={date} onChange={(e) => setDate(e.target.value)} className="date-input-overlay" aria-label="Fecha del retiro" required min={firstIncomeDate || undefined}/></div></div>
                    <div className="form-group"><label htmlFor="withdraw-bank">Desde la cuenta</label><select id="withdraw-bank" value={selectedBank} onChange={e => setSelectedBank(e.target.value)} disabled={banksWithFunds.length === 0} style={selectStyle}>{banksWithFunds.length > 0 ? (banksWithFunds.map(bank => (<option key={bank.name} value={bank.name}>{bank.name} ({formatCurrency(bankBalances[bank.name])})</option>))) : (<option>No hay fondos en ninguna cuenta</option>)}</select></div>
                    <div className="form-group"><label htmlFor="withdraw-amount">Monto a retirar</label><input id="withdraw-amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" min="0.01" step="0.01" disabled={banksWithFunds.length === 0} autoFocus/>{error && <p className="error-message">{error}</p>}</div>
                    <div className="confirmation-dialog-buttons"><button onClick={handleClose} className="btn-cancel">Cancelar</button><button onClick={handleConfirm} className="btn-confirm-edit" disabled={!!error || !amount || !selectedBank}>Confirmar</button></div>
                </div>
            </div>
        </div>
    );
  };

  const DepositModal = ({ isOpen, onClose, onConfirm, banks, cashBalance, formatCurrency, firstIncomeDate, incomes, expenses, isHistoryValid }: { isOpen: boolean, onClose: () => void, onConfirm: (bankName: string, amount: number, date: string) => void, banks: Bank[], cashBalance: number, formatCurrency: (value: number) => string, firstIncomeDate: string | null, incomes: Transaction[], expenses: Transaction[], isHistoryValid: (i: Transaction[], e: Transaction[]) => boolean }) => {
    const [selectedBank, setSelectedBank] = useState<string>('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(getToday());
    const [error, setError] = useState('');
  
    useEffect(() => {
      if (banks.length > 0 && !selectedBank) setSelectedBank(banks[0].name);
      else if (banks.length === 0) setSelectedBank('');
    }, [banks, selectedBank]);
  
    useEffect(() => {
        const numericAmount = parseFloat(amount);
        if (!amount || isNaN(numericAmount) || numericAmount <= 0) { setError(''); return; }
        if (!selectedBank) { setError('Por favor, selecciona un banco.'); return; }
        
        const expenseTransfer: Transaction = { id: Date.now(), description: 'Transferencia entre cuentas', amount: numericAmount, date: date, paymentMethod: 'cash', isTransfer: true, transferId: Date.now() };
        const incomeTransfer: Transaction = { id: Date.now() + 1, description: 'Transferencia entre cuentas', amount: numericAmount, date: date, paymentMethod: 'card', bank: selectedBank, isTransfer: true, transferId: Date.now() };
        
        if (!isHistoryValid([...incomes, incomeTransfer], [...expenses, expenseTransfer])) setError(`Este deposito resultaria en un saldo de efectivo negativo.`);
        else setError('');
    }, [amount, selectedBank, date, incomes, expenses, isHistoryValid]);
  
    if (!isOpen) return null;
  
    const handleConfirm = () => {
      if (!error && selectedBank && amount) {
        onConfirm(selectedBank, parseFloat(amount), date);
        setAmount(''); setDate(getToday()); setError(''); setSelectedBank(banks.length > 0 ? banks[0].name : '');
      }
    };
    
    const handleClose = () => {
      setAmount(''); setDate(getToday()); setError(''); setSelectedBank(banks.length > 0 ? banks[0].name : ''); onClose();
    }
  
    return (
      <div className="edit-bank-modal-overlay" onClick={handleClose}>
        <div className="edit-bank-modal" onClick={(e) => e.stopPropagation()}>
          <h2>Depositar Dinero</h2>
          <div className="edit-bank-form">
            <div className="form-group"><label htmlFor="deposit-date">Fecha del Deposito</label><div className="date-picker-container"><div className="date-picker-display" aria-hidden="true">{formatDate(date)}</div><input type="date" id="deposit-date" value={date} onChange={(e) => setDate(e.target.value)} className="date-input-overlay" aria-label="Fecha del deposito" required min={firstIncomeDate || undefined}/></div></div>
            <div className="form-group"><label>Efectivo Disponible</label><p className="modal-balance-display">{formatCurrency(cashBalance)}</p></div>
            <div className="form-group"><label htmlFor="deposit-bank">A la cuenta</label><select id="deposit-bank" value={selectedBank} onChange={e => setSelectedBank(e.target.value)} disabled={banks.length === 0}>{banks.length > 0 ? (banks.map(bank => (<option key={bank.name} value={bank.name}>{bank.name}</option>))) : (<option>No hay bancos para depositar</option>)}</select></div>
            <div className="form-group"><label htmlFor="deposit-amount">Monto a depositar</label><input id="deposit-amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" min="0.01" step="0.01" disabled={banks.length === 0 || cashBalance <= 0} autoFocus/>{error && <p className="error-message">{error}</p>}</div>
            <div className="confirmation-dialog-buttons"><button onClick={handleClose} className="btn-cancel">Cancelar</button><button onClick={handleConfirm} className="btn-confirm-edit" disabled={!!error || !amount || !selectedBank}>Confirmar</button></div>
          </div>
        </div>
      </div>
    );
  };
  
  interface Filters {
    type: 'all' | 'income' | 'expense' | 'transfer';
    paymentMethod: 'all' | 'card' | 'cash';
    banks: string[];
    startDate: string;
    endDate: string;
  }

  const FilterModal = ({ isOpen, onClose, onApply, onReset, initialFilters, banks }: { isOpen: boolean; onClose: () => void; onApply: (filters: Filters) => void; onReset: () => void; initialFilters: Filters; banks: Bank[]; }) => {
    const [filters, setFilters] = useState<Filters>(initialFilters);

    useEffect(() => { if(isOpen) setFilters(initialFilters); }, [isOpen, initialFilters]);

    const handleBankToggle = (bankName: string) => {
        setFilters(prev => ({ ...prev, banks: prev.banks.includes(bankName) ? prev.banks.filter(b => b !== bankName) : [...prev.banks, bankName] }));
    };

    const handleApply = () => { onApply(filters); onClose(); };
    const handleReset = () => { onReset(); onClose(); };
    
    if (!isOpen) return null;

    const banksDisabled = filters.paymentMethod === 'cash';

    return (
        <div className="filter-modal-overlay" onClick={onClose}>
            <div className="filter-modal" onClick={(e) => e.stopPropagation()}>
                <div className="filter-modal-header"><h2>Filtros</h2><button onClick={onClose} className="close-btn" aria-label="Cerrar modal de filtros">&times;</button></div>
                <div className="filter-modal-body">
                    <div className="filter-section"><h3>Fecha</h3><div className="filter-date-range"><div className="form-group"><label htmlFor="start-date">Desde</label><div className="date-picker-container"><div className="date-picker-display" aria-hidden="true">{filters.startDate ? formatDate(filters.startDate) : 'No seleccionada'}</div><input type="date" id="start-date" value={filters.startDate} onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))} className="date-input-overlay" aria-label="Fecha de inicio"/></div></div><div className="form-group"><label htmlFor="end-date">Hasta</label><div className="date-picker-container"><div className="date-picker-display" aria-hidden="true">{filters.endDate ? formatDate(filters.endDate) : 'No seleccionada'}</div><input type="date" id="end-date" value={filters.endDate} onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))} className="date-input-overlay" aria-label="Fecha de fin" min={filters.startDate || undefined}/></div></div></div></div>
                    <div className="filter-section"><h3>Tipo de Transaccion</h3><div className="filter-option-group"><div className={`filter-option ${filters.type === 'all' ? 'active' : ''}`} onClick={() => setFilters(f => ({ ...f, type: 'all' }))}>Todos</div><div className={`filter-option ${filters.type === 'income' ? 'active' : ''}`} onClick={() => setFilters(f => ({ ...f, type: 'income' }))}>Ingresos</div><div className={`filter-option ${filters.type === 'expense' ? 'active' : ''}`} onClick={() => setFilters(f => ({ ...f, type: 'expense' }))}>Gastos</div><div className={`filter-option ${filters.type === 'transfer' ? 'active' : ''}`} onClick={() => setFilters(f => ({ ...f, type: 'transfer' }))}>Transferencias</div></div></div>
                    <div className="filter-section"><h3>Metodo de Pago</h3><div className="filter-option-group"><div className={`filter-option ${filters.paymentMethod === 'all' ? 'active' : ''}`} onClick={() => setFilters(f => ({ ...f, paymentMethod: 'all' }))}>Todos</div><div className={`filter-option ${filters.paymentMethod === 'card' ? 'active' : ''}`} onClick={() => setFilters(f => ({ ...f, paymentMethod: 'card' }))}>Tarjeta</div><div className={`filter-option ${filters.paymentMethod === 'cash' ? 'active' : ''}`} onClick={() => setFilters(f => ({ ...f, paymentMethod: 'cash' }))}>Efectivo</div></div></div>
                     {banks.length > 0 && (<div className={`filter-section ${banksDisabled ? 'disabled' : ''}`}><h3>Bancos</h3><div className="filter-bank-list">{banks.map(bank => (<label key={bank.name} className="bank-checkbox-label"><input type="checkbox" checked={filters.banks.includes(bank.name)} onChange={() => handleBankToggle(bank.name)} disabled={banksDisabled}/><span className="bank-checkbox-custom" style={{ '--bank-color': bank.color } as React.CSSProperties}></span><span>{bank.name}</span></label>))}</div></div>)}
                </div>
                <div className="filter-modal-footer"><button onClick={handleReset} className="btn-cancel">Limpiar Filtros</button><button onClick={handleApply} className="btn-confirm-edit">Aplicar</button></div>
            </div>
        </div>
    );
  };

  const TransactionHistory = ({ transactions, banks, formatCurrency, formatDate, onDelete, categories }: { transactions: RenderableTransaction[], banks: Bank[], formatCurrency: (value: number) => string, formatDate: (date: string) => string, onDelete: (transaction: RenderableTransaction) => void, categories: Category[] }) => {
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const initialFilters: Filters = { type: 'all', paymentMethod: 'all', banks: [], startDate: '', endDate: '' };
    const [filters, setFilters] = useState<Filters>(initialFilters);

    const areFiltersActive = useMemo(() => {
        return filters.type !== 'all' || filters.paymentMethod !== 'all' || filters.banks.length > 0 || filters.startDate !== '' || filters.endDate !== '';
    }, [filters]);

    const filteredTransactions = useMemo(() => {
      return transactions.filter(t => {
        if (filters.startDate && t.date < filters.startDate) return false;
        if (filters.endDate && t.date > filters.endDate) return false;
        if (filters.type !== 'all' && t.type !== filters.type) return false;
        if (filters.paymentMethod !== 'all') {
          if (t.type === 'transfer') {
            if (filters.paymentMethod === 'card' && t.from.method !== 'card' && t.to.method !== 'card') return false;
            if (filters.paymentMethod === 'cash' && t.from.method !== 'cash' && t.to.method !== 'cash') return false;
          } else {
            if (t.paymentMethod !== filters.paymentMethod) return false;
          }
        }
        if (filters.banks.length > 0 && filters.paymentMethod !== 'cash') {
           if (t.type === 'transfer') {
               const fromBank = t.from.bank || '', toBank = t.to.bank || '';
               if (t.from.method === 'card' && t.to.method === 'card') {
                 if (!filters.banks.includes(fromBank) && !filters.banks.includes(toBank)) return false;
               } else if (t.from.method === 'card') {
                 if (!filters.banks.includes(fromBank)) return false;
               } else if (t.to.method === 'card') {
                 if (!filters.banks.includes(toBank)) return false;
               } else { return false; }
           } else if (t.type === 'income' || t.type === 'expense') {
               if (t.paymentMethod !== 'card' || !filters.banks.includes(t.bank || '')) return false;
           }
        }
        return true;
      });
    }, [transactions, filters]);

    const getStartOfWeek = (dateString: string) => {
      const date = new Date(dateString);
      date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(date.setDate(diff));
      return new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate());
    };

    const groupedTransactions = useMemo(() => {
      return filteredTransactions.reduce((acc: { [key: string]: RenderableTransaction[] }, transaction) => {
        const startOfWeek = getStartOfWeek(transaction.date).toISOString().split('T')[0];
        if (!acc[startOfWeek]) acc[startOfWeek] = [];
        acc[startOfWeek].push(transaction);
        return acc;
      }, {});
    }, [filteredTransactions]);
    
    if (transactions.length === 0) {
      return (
        <div className="transaction-history-container"><h2 className="summary-title">Historial de Transacciones</h2><p className="no-transactions-message">No hay transacciones todavia.</p></div>
      );
    }
    
    return (
      <div className="transaction-history-container">
        <div className="history-header"><h2 className="summary-title">Historial de Transacciones</h2><button className={`filter-btn ${areFiltersActive ? 'active' : ''}`} onClick={() => setIsFilterModalOpen(true)} aria-label="Filtrar transacciones"><FilterIcon /></button></div>
        <FilterModal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} onApply={setFilters} onReset={() => setFilters(initialFilters)} initialFilters={filters} banks={banks} />
        {filteredTransactions.length > 0 ? (
            <ul className="transaction-list">
            {Object.entries(groupedTransactions).map(([weekStart, weekTransactions]) => (
                <li key={weekStart}>
                <h3 className="week-header">Semana del {formatDate(weekStart).split(' ').slice(1).join(' ')}</h3>
                <ul className="week-transactions">
                {weekTransactions.map(transaction => {
                    if (transaction.type === 'transfer') {
                        const fromText = transaction.from.method === 'card' ? transaction.from.bank : 'Efectivo';
                        const toText = transaction.to.method === 'card' ? transaction.to.bank : 'Efectivo';
                        const fromBank = transaction.from.method === 'card' ? banks.find(b => b.name === transaction.from.bank) : null;
                        const toBank = transaction.to.method === 'card' ? banks.find(b => b.name === transaction.to.bank) : null;
                        return (
                            <li key={transaction.id} className="transaction-item">
                                <div className="transaction-icon-container transfer"><TransferIcon /></div>
                                <div className="transaction-details">
                                    <div className="transaction-row"><span className="transaction-description">Transferencia</span><span className="transaction-amount" style={{color: 'var(--text-primary)'}}>{formatCurrency(transaction.amount)}</span></div>
                                    <div className="transaction-row"><span className="transaction-date">{formatDate(transaction.date)}</span><div className="transaction-meta transfer-meta"><span className="transaction-bank" style={{ backgroundColor: fromBank ? fromBank.color : 'var(--cash-green)' }}>{fromText}</span><span>&rarr;</span><span className="transaction-bank" style={{ backgroundColor: toBank ? toBank.color : 'var(--cash-green)' }}>{toText}</span></div></div>
                                </div>
                                <button onClick={() => onDelete(transaction)} className="delete-btn" aria-label="Eliminar transferencia"><TrashIcon /></button>
                            </li>
                        );
                    }
                    
                    const bank = transaction.paymentMethod === 'card' && transaction.bank ? banks.find(b => b.name === transaction.bank) : null;
                    const category = transaction.type === 'expense' && transaction.category ? categories.find(c => c.name === transaction.category) : null;
                    const categoryIconKey = category ? category.icon : 'CreditCard';
                    
                    return (
                        <li key={transaction.id} className="transaction-item">
                            <div className={`transaction-icon-container ${transaction.type}`}>
                            {transaction.type === 'income' ? <ArrowUpRightIcon /> : <CategoryIcon iconKey={categoryIconKey} />}
                            </div>
                            <div className="transaction-details">
                                <div className="transaction-row"><span className="transaction-description">{transaction.description}</span><span className={`transaction-amount ${transaction.type === 'income' ? 'income-amount' : 'expense-amount'}`}>{transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}</span></div>
                                <div className="transaction-row">
                                    <span className="transaction-date">{formatDate(transaction.date)}</span>
                                    <div className="transaction-meta">
                                        {transaction.category && <span className="transaction-bank">{transaction.category}</span>}
                                        {transaction.paymentMethod === 'card' && transaction.bank && (<span className="transaction-bank" style={{ backgroundColor: bank ? bank.color : '#424242' }}>{transaction.bank}</span>)}
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => onDelete(transaction)} className="delete-btn" aria-label="Eliminar transaccion"><TrashIcon /></button>
                        </li>
                    );
                })}
                </ul>
                </li>
            ))}
            </ul>
        ) : (<p className="no-transactions-message">No hay transacciones que coincidan con los filtros.</p>)}
      </div>
    );
  };

  const handleAddCountry = (newCountry: Omit<Country, 'locale'>) => {
      setCountries(prev => [...prev, { ...newCountry, locale: `es-${newCountry.code}` }]);
  };
  
  const handleGenerateAndAddCountry = async (name: string, flag: string) => {
    if (countries.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        alert(`El pais "${name}" ya existe.`);
        return;
    }

    setIsGeneratingCountry(true);
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Basado en el nombre del pais "${name}" y su bandera "${flag}", proporciona su codigo de pais ISO 3166-1 alfa-2 de 2 letras y su codigo de moneda ISO 4217 de 3 letras.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        code: {
                            type: Type.STRING,
                            description: "El codigo de pais de 2 letras (ISO 3166-1 alpha-2).",
                        },
                        currency: {
                            type: Type.STRING,
                            description: "El codigo de moneda de 3 letras (ISO 4217).",
                        },
                    },
                    required: ["code", "currency"],
                },
            },
        });

        const jsonResponse = JSON.parse(response.text);
        const { code, currency } = jsonResponse;

        if (code && currency && /^[A-Z]{2}$/.test(code) && /^[A-Z]{3}$/.test(currency)) {
             if (countries.some(c => c.code === code)) {
                alert(`El codigo de pais generado (${code}) para ${name} ya existe. Intenta anadirlo de nuevo o con otro nombre.`);
                return;
            }
            handleAddCountry({ name, flag, code, currency });
            setIsAddCountryModalOpen(false);
        } else {
            throw new Error("Respuesta invalida de la IA. Codigo o moneda no validos.");
        }
    } catch (error) {
        console.error("Error al generar detalles del pais:", error);
        alert("No se pudieron generar los detalles del pais. Por favor, intentalo de nuevo.");
    } finally {
        setIsGeneratingCountry(false);
    }
  };

  const confirmDeleteCountry = () => {
    if (!countryToDelete) return;

    setCountries(countries.filter(c => c.code !== countryToDelete.code));

    localStorage.removeItem(`expenses_${countryToDelete.code}`);
    localStorage.removeItem(`incomes_${countryToDelete.code}`);
    localStorage.removeItem(`banks_${countryToDelete.code}`);
    localStorage.removeItem(`categories_${countryToDelete.code}`);
    localStorage.removeItem(`fixedExpenses_${countryToDelete.code}`);

    setCountryToDelete(null);
  };


  const renderWelcomeScreen = () => (
    <div className="welcome-container">
       <div className="welcome-header"><h1>Bienvenido al Control de Gastos</h1></div>
      <p>Selecciona tu pais para comenzar</p>
      <div className="country-selection-grid">
         {countries.map(c => (
             <div className="country-option" key={c.code}>
                <button className="delete-country-btn" onClick={() => setCountryToDelete(c)} aria-label={`Eliminar ${c.name}`}>
                    <TrashIcon />
                </button>
                <button 
                    className="country-flag-btn" 
                    onClick={() => { setCountry(c.code); setView('summary'); }} 
                    aria-label={c.name}
                >
                    {c.flag}
                </button>
            </div>
         ))}
      </div>
      <div className="add-country-wrapper">
         <button className="add-country-btn" onClick={() => setIsAddCountryModalOpen(true)} aria-label="Anadir nuevo pais">+</button>
      </div>
    </div>
  );

  const renderExpenseTracker = () => {
    const isCashDisabled = availableBalance.cash <= 0;
    const currentCategoryInfo = categories.find(c => c.name === expenseCategory);
    
    return (
    <div className="app-container">
      <h1 className="expense-title">Anadir Gasto</h1>
      <BalanceSummary availableBalance={availableBalance} banks={banks} bankBalances={bankBalances} formatCurrency={formatCurrency} onBankClick={availableBalance.card > 0 ? handleBankClickWithdraw : undefined} onCashClick={availableBalance.cash > 0 ? () => setIsDepositModalOpen(true) : undefined} />
      
      <form className="expense-form" onSubmit={handleAddExpense}>
        <div className="payment-method-selector">
            <label onClick={() => handleExpensePaymentToggle('card')}><input type="radio" name="expense-method" value="card" checked={expensePaymentMethod === 'card'} readOnly /><span className="method-label">Tarjeta</span></label>
            <label onClick={() => !isCashDisabled && handleExpensePaymentToggle('cash')}><input type="radio" name="expense-method" value="cash" checked={expensePaymentMethod === 'cash'} readOnly disabled={isCashDisabled} /><span className="method-label">Efectivo</span></label>
        </div>
        <div className={`collapsible-form-section ${isExpenseFormExpanded ? 'expanded' : ''}`}>
          <div className="collapsible-content">
            {expenseSelectedBank && (<p className="selected-bank-info" style={{ backgroundColor: banks.find(b=>b.name === expenseSelectedBank)?.color }}>Banco: <strong>{expenseSelectedBank}</strong></p>)}
            <button type="button" className="btn-manage btn-fixed-expenses" onClick={() => setFixedExpenseModalContext('select')}>
                <RepeatIcon />
                <span>Cargar Gasto Fijo</span>
            </button>
            <div className="amount-input-container">
                <input ref={expenseAmountInputRef} inputMode="decimal" type="number" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} placeholder="Monto" aria-label="Monto del gasto" min="0.01" step="0.01" required />
                {expenseError && <p className="error-message">{expenseError}</p>}
            </div>
            <input type="text" value={expenseDescription} onChange={(e) => setExpenseDescription(e.target.value)} placeholder="Descripcion del gasto" aria-label="Descripcion del gasto" required />
            <div className="date-picker-container"><div className="date-picker-display" aria-hidden="true">{formatDate(expenseDate)}</div><input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className="date-input-overlay" aria-label="Fecha del gasto" required min={firstIncomeDate || undefined}/></div>
             <div className="form-group">
                <label>Categoria</label>
                <button type="button" className="custom-select-button" onClick={() => setCategoryModalContext('expense')}>
                    {currentCategoryInfo ? (
                        <span className="category-display">
                            <CategoryIcon iconKey={currentCategoryInfo.icon} />
                            <span>{currentCategoryInfo.name}</span>
                        </span>
                    ) : (
                        <span className="placeholder">Seleccionar categoria</span>
                    )}
                    <span className="arrow-down" />
                </button>
              </div>
            <button type="submit" className="btn-expense" disabled={!expenseDescription.trim() || !expenseAmount || !expenseDate || !!expenseError || (expensePaymentMethod === 'card' && !expenseSelectedBank)}>Anadir Gasto</button>
          </div>
        </div>
      </form>
    </div>
  )};

  const renderIncomeTracker = () => (
     <div className="app-container">
      <h1 className="income-title">Anadir Ingreso</h1>
      <BalanceSummary availableBalance={availableBalance} banks={banks} bankBalances={bankBalances} formatCurrency={formatCurrency} onBankClick={availableBalance.card > 0 ? handleBankClickWithdraw : undefined} onCashClick={availableBalance.cash > 0 ? () => setIsDepositModalOpen(true) : undefined} />
      <form className="expense-form" onSubmit={handleAddIncome}>
        <div className="payment-method-selector">
          <label onClick={() => handleIncomePaymentToggle('card')}><input type="radio" name="income-method" value="card" checked={incomePaymentMethod === 'card'} readOnly/><span className="method-label">Tarjeta</span></label>
          <label onClick={() => handleIncomePaymentToggle('cash')}><input type="radio" name="income-method" value="cash" checked={incomePaymentMethod === 'cash'} readOnly/><span className="method-label">Efectivo</span></label>
        </div>
        <div className={`collapsible-form-section ${isIncomeFormExpanded ? 'expanded' : ''}`}>
          <div className="collapsible-content">
            {selectedBank && (<p className="selected-bank-info" style={{ backgroundColor: banks.find(b=>b.name===selectedBank)?.color }}>Banco: <strong>{selectedBank}</strong></p>)}
            <input ref={incomeAmountInputRef} inputMode="decimal" type="number" value={incomeAmount} onChange={(e) => setIncomeAmount(e.target.value)} placeholder="Monto" aria-label="Monto del ingreso" min="0.01" step="0.01" required />
            <input type="text" value={incomeDescription} onChange={(e) => setIncomeDescription(e.target.value)} placeholder="Descripcion del ingreso" aria-label="Descripcion del ingreso" required />
            <div className="date-picker-container"><div className="date-picker-display" aria-hidden="true">{formatDate(incomeDate)}</div><input type="date" value={incomeDate} onChange={(e) => setIncomeDate(e.target.value)} className="date-input-overlay" aria-label="Fecha del ingreso" required/></div>
            <button type="submit" className="btn-income" disabled={!incomeDescription.trim() || !incomeAmount || !incomeDate || (incomePaymentMethod === 'card' && !selectedBank)}>Anadir Ingreso</button>
          </div>
        </div>
      </form>
    </div>
  );
  
  const renderSummaryView = () => (
    <div className="app-container">
        <h1>Resumen General</h1>
        <BalanceSummary availableBalance={availableBalance} banks={banks} bankBalances={bankBalances} formatCurrency={formatCurrency} onBankClick={availableBalance.card > 0 ? handleBankClickWithdraw : undefined} onCashClick={availableBalance.cash > 0 ? () => setIsDepositModalOpen(true) : undefined} />
        
        <div className="summary-section-container">
            <h2 className="summary-title">Resumen Mensual</h2>
            <div className="summary-grid">
                <div className="summary-box clickable" onClick={() => handleShowMonthlyDetail('income')}>
                    <h3>Ingresos (este mes)</h3>
                    <p className="income-amount">{formatCurrency(incomeSummary.esteMes)}</p>
                </div>
                <div className="summary-box clickable" onClick={() => handleShowMonthlyDetail('expense')}>
                    <h3>Gastos (este mes)</h3>
                    <p className="expense-amount">{formatCurrency(expenseSummary.esteMes)}</p>
                </div>
            </div>
        </div>

        <div className="summary-section-container">
            <h2 className="summary-title">Balance Global</h2>
            <div className="summary-grid">
                <div className="summary-box">
                    <h3>Ingresos (total)</h3>
                    <p className="income-amount">{formatCurrency(incomeSummary.global)}</p>
                </div>
                <div className="summary-box">
                    <h3>Gastos (total)</h3>
                    <p className="expense-amount">{formatCurrency(expenseSummary.global)}</p>
                </div>
            </div>
        </div>
        
        <TransactionHistory transactions={allTransactions} banks={banks} formatCurrency={formatCurrency} formatDate={formatDate} onDelete={handleDeleteTransaction} categories={categories} />
    </div>
  );
  
  const renderSettingsView = () => (
    <div className="app-container">
      <h1>Ajustes</h1>
      <div className="settings-section">
        <h3>Tema</h3>
        <div className="theme-switcher">
          <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>Claro</button>
          <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>Oscuro</button>
        </div>
      </div>
      <div className="settings-section">
        <h3>Personalizacion</h3>
        <button className="btn-manage" onClick={() => setIsBankModalOpen(true)}>Gestionar Bancos</button>
        <button className="btn-manage" onClick={() => setCategoryModalContext('settings')}>Gestionar Categorias</button>
        <button className="btn-manage" onClick={() => setFixedExpenseModalContext('manage')}>Gestionar Gastos Fijos</button>
      </div>
      <div className="settings-section">
        <h3>Datos</h3>
        <button className="btn-manage" onClick={handleExportData}>
          <FileTextIcon />
          <span>Exportar Datos del Pais</span>
        </button>
      </div>
    </div>
  );
  
  const renderContent = () => {
    switch (view) {
      case 'expenses': return renderExpenseTracker();
      case 'income': return renderIncomeTracker();
      case 'summary': return renderSummaryView();
      case 'settings': return renderSettingsView();
      case 'welcome':
      default: return renderWelcomeScreen();
    }
  };

  return (
    <div id="app-wrapper" className={view === 'income' ? 'income-glow' : view === 'expenses' ? 'expense-glow' : ''}>
      <div className="view-container" key={view}>{renderContent()}</div>
      
      {transactionToDelete && <ConfirmationDialog message="¿Estas seguro de que quieres eliminar esta transaccion?" onConfirm={confirmDeleteTransaction} onCancel={cancelDeleteTransaction} />}
      
      {bankToDelete && <ConfirmationDialog message={`¿Estas seguro de que quieres eliminar el banco "${bankToDelete.name}"?`} onConfirm={confirmDeleteBank} onCancel={cancelDeleteBank} />}
      {countryToDelete && <ConfirmationDialog message={`¿Estas seguro de que quieres eliminar ${countryToDelete.name}? Se perderan todos los datos asociados.`} onConfirm={confirmDeleteCountry} onCancel={() => setCountryToDelete(null)} />}

      {isBankModalOpen && <BankSelectionModal banks={bankModalContext === 'expense' ? banksWithFunds : banks} onSelect={handleBankSelected} onAddBank={handleBankAdded} onClose={() => { setIsBankModalOpen(false); setBankModalContext(null); }} onDeleteBank={handleDeleteBankRequest} onEditBank={handleEditBankRequest} bankBalances={bankBalances} formatCurrency={formatCurrency} />}
      {bankToEdit && <EditBankModal bank={bankToEdit} onUpdateBank={handleUpdateBank} onClose={() => { setBankToEdit(null); setIsBankModalOpen(true); }} />}
      {isAddCountryModalOpen && <AddCountryModal isOpen={isAddCountryModalOpen} onClose={() => setIsAddCountryModalOpen(false)} onGenerateCountry={handleGenerateAndAddCountry} isGenerating={isGeneratingCountry} />}

      {categoryModalContext !== null && (
        <CategoriesModal
            isOpen={categoryModalContext !== null}
            onClose={() => {
                setCategoryModalContext(null);
                setCategorySetterForFixedExpense(null);
            }}
            initialView={categoryModalContext === 'expense' || categoryModalContext === 'fixedExpense' ? 'select' : 'list'}
            categories={categories}
            expenses={expenses}
            onAddCategory={handleAddCategory}
            onUpdateCategory={handleUpdateCategory}
            onDeleteCategory={handleDeleteCategory}
            onSelect={(categoryName) => {
                if (categoryModalContext === 'expense') {
                    setExpenseCategory(categoryName);
                } else if (categoryModalContext === 'fixedExpense' && categorySetterForFixedExpense) {
                    categorySetterForFixedExpense(categoryName);
                }
                setCategoryModalContext(null);
                setCategorySetterForFixedExpense(null);
            }}
            selectedCategory={expenseCategory}
        />
      )}

      {fixedExpenseModalContext !== null && (
        <FixedExpensesModal
            isOpen={fixedExpenseModalContext !== null}
            onClose={() => setFixedExpenseModalContext(null)}
            fixedExpenses={fixedExpenses}
            categories={categories}
            onAdd={handleAddFixedExpense}
            onUpdate={handleUpdateFixedExpense}
            onDelete={handleDeleteFixedExpense}
            formatCurrency={formatCurrency}
            onOpenCategoryModal={(setter) => {
                setCategorySetterForFixedExpense(() => setter);
                setCategoryModalContext('fixedExpense');
            }}
            onSelect={fixedExpenseModalContext === 'select' ? handleSelectFixedExpense : undefined}
        />)}

      {isWithdrawModalOpen && <WithdrawModal isOpen={isWithdrawModalOpen} onClose={() => { setIsWithdrawModalOpen(false); setWithdrawSourceBank(null); }} onConfirm={handleWithdraw} banksWithFunds={banksWithFunds} bankBalances={bankBalances} formatCurrency={formatCurrency} firstIncomeDate={firstIncomeDate} incomes={incomes} expenses={expenses} isHistoryValid={isHistoryValid} initialBankName={withdrawSourceBank} />}
      {isDepositModalOpen && <DepositModal isOpen={isDepositModalOpen} onClose={() => setIsDepositModalOpen(false)} onConfirm={handleDeposit} banks={banks} cashBalance={availableBalance.cash} formatCurrency={formatCurrency} firstIncomeDate={firstIncomeDate} incomes={incomes} expenses={expenses} isHistoryValid={isHistoryValid} />}
      
      <TransactionDetailModal isOpen={transactionModalDetails.isOpen} onClose={() => setTransactionModalDetails({isOpen: false, title: '', transactions: []})} title={transactionModalDetails.title} transactions={transactionModalDetails.transactions} banks={banks} formatCurrency={formatCurrency} formatDate={formatDate} />
      <IncomeBreakdownModal isOpen={isIncomeBreakdownModalOpen} onClose={() => setIsIncomeBreakdownModalOpen(false)} total={incomeSummary.esteMes} cardTotal={incomeSummary.tarjetaEsteMesIngresos} cashTotal={incomeSummary.efectivoEsteMesIngresos} formatCurrency={formatCurrency}/>
      <ExpenseBreakdownModal isOpen={isExpenseBreakdownModalOpen} onClose={() => setIsExpenseBreakdownModalOpen(false)} total={expenseSummary.esteMes} cardTotal={expenseSummary.tarjetaEsteMesGastos} cashTotal={expenseSummary.efectivoEsteMesGastos} formatCurrency={formatCurrency}/>
      
      {view !== 'welcome' && <BottomNavBar view={view} setView={setView} onGoToWelcome={handleGoToWelcome} />}
    </div>
  );
};

const AddCountryModal = ({ isOpen, onClose, onGenerateCountry, isGenerating }: { isOpen: boolean, onClose: () => void, onGenerateCountry: (name: string, flag: string) => void, isGenerating: boolean }) => {
    const [name, setName] = useState('');
    const [flag, setFlag] = useState('');
    const [error, setError] = useState('');
    
    const flags = useMemo(() => ['🇦🇷','🇦🇺','🇧🇴','🇧🇷','🇨🇦','🇨🇱','🇨🇳','🇨🇴','🇨🇷','🇩🇴','🇪🇨','🇸🇻','🇫🇷','🇩🇪','🇬🇹','🇭🇳','🇮🇳','🇮🇹','🇯🇵','🇲🇽','🇳🇮','🇵🇦','🇵🇾','🇵🇪','🇵🇹','🇰🇷','🇸🇪','🇨🇭','🇬🇧','🇺🇸','🇺🇾','🇻🇪'], []);

    useEffect(() => {
        if (!isOpen) {
            // Reset form on close
            setTimeout(() => {
                setName('');
                setFlag('');
                setError('');
            }, 300);
        }
    }, [isOpen]);

    const handleSubmit = () => {
        setError('');
        if (!name.trim()) { setError('El nombre del pais no puede estar vacio.'); return; }
        if (!flag) { setError('Por favor, selecciona una bandera.'); return; }
        onGenerateCountry(name.trim(), flag);
    };

    if (!isOpen) return null;

    return (
        <div className="edit-bank-modal-overlay" onClick={onClose}>
            <div className="edit-bank-modal" onClick={(e) => e.stopPropagation()}>
                <h2>Anadir Nuevo Pais</h2>
                <div className="edit-bank-form">
                    <div className="form-group"><label htmlFor="country-name">Nombre del Pais</label><input id="country-name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Mexico" autoFocus /></div>
                    <div className="form-group"><label>Bandera</label><div className="flag-picker">{flags.map(f => <button key={f} className={`flag-picker-btn ${flag === f ? 'selected' : ''}`} onClick={() => setFlag(f)}>{f}</button>)}</div></div>
                    {error && <p className="error-message" style={{textAlign: 'center'}}>{error}</p>}
                    <div className="confirmation-dialog-buttons">
                        <button onClick={onClose} className="btn-cancel" disabled={isGenerating}>Cancelar</button>
                        <button onClick={handleSubmit} className="btn-confirm-edit" disabled={isGenerating}>
                            {isGenerating ? 'Creando...' : 'Crear Pais'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const FixedExpensesModal = ({ isOpen, onClose, fixedExpenses, categories, onAdd, onUpdate, onDelete, formatCurrency, onOpenCategoryModal, onSelect, }: { isOpen: boolean; onClose: () => void; fixedExpenses: FixedExpense[]; categories: Category[]; onAdd: (newFe: Omit<FixedExpense, 'id'>) => void; onUpdate: (updatedFe: FixedExpense) => void; onDelete: (id: number) => void; formatCurrency: (value: number) => string; onOpenCategoryModal: (setter: (name: string) => void) => void; onSelect?: (expense: FixedExpense) => void; }) => {
    const [modalView, setModalView] = useState<'list' | 'form'>('list');
    const [editingExpense, setEditingExpense] = useState<FixedExpense | null>(null);

    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setTimeout(() => {
                setModalView('list');
                setEditingExpense(null);
                setError('');
            }, 300);
        } else {
            // Reset to list view whenever it opens
            setModalView('list');
        }
    }, [isOpen]);

    const resetForm = () => {
        setDescription('');
        setAmount('');
        setCategory(categories.length > 0 ? categories[0].name : '');
        setError('');
    };

    const handleAddNew = () => {
        setEditingExpense(null);
        resetForm();
        setModalView('form');
    };

    const handleEdit = (expense: FixedExpense) => {
        setEditingExpense(expense);
        setDescription(expense.description);
        setAmount(String(expense.amount));
        setCategory(expense.category);
        setError('');
        setModalView('form');
    };

    const handleCancel = () => {
        setModalView('list');
        setEditingExpense(null);
    };

    const handleDelete = (id: number) => {
        if (window.confirm('¿Estas seguro de que quieres eliminar este gasto fijo? Esto no afectara a los gastos ya registrados.')) {
            onDelete(id);
        }
    };

    const handleSave = () => {
        const numericAmount = parseFloat(amount);

        if (!description.trim()) { setError('La descripcion no puede estar vacia.'); return; }
        if (isNaN(numericAmount) || numericAmount <= 0) { setError('Por favor, introduce un monto valido.'); return; }
        if (!category) { setError('Debes seleccionar una categoria.'); return; }
        
        setError('');

        const expenseData = {
            description: description.trim(),
            amount: numericAmount,
            category,
        };

        if (editingExpense) {
            onUpdate({ ...expenseData, id: editingExpense.id });
        } else {
            onAdd(expenseData);
        }
        handleCancel();
    };

    if (!isOpen) return null;
    
    const currentCategoryInfo = categories.find(c => c.name === category);

    return (
        <div className="bank-modal-overlay" onClick={onClose}>
            <div className="bank-modal manage-categories-modal" onClick={(e) => e.stopPropagation()}>
                {modalView === 'list' && (
                    <>
                        <h2>{onSelect ? 'Seleccionar Gasto Fijo' : 'Gestionar Gastos Fijos'}</h2>
                        <div className="category-management-list">
                            {fixedExpenses.length > 0 ? fixedExpenses.map(fe => (
                                <div key={fe.id} className="category-management-item">
                                    <div
                                      className={`category-info ${onSelect ? 'selectable' : ''}`}
                                      style={{alignItems: 'flex-start', flexDirection: 'column', gap: '0.25rem'}}
                                      onClick={onSelect ? () => onSelect(fe) : undefined}
                                    >
                                        <div style={{fontWeight: 600}}>{fe.description}</div>
                                        <div style={{fontSize: '0.9rem', color: 'var(--text-secondary)'}}>
                                            {formatCurrency(fe.amount)}
                                        </div>
                                    </div>
                                    <div className="category-actions">
                                        <button className="bank-action-btn" onClick={() => handleEdit(fe)}><PencilIcon /></button>
                                        <button className="bank-action-btn" onClick={() => handleDelete(fe.id)}><TrashIcon /></button>
                                    </div>
                                </div>
                            )) : <p className="no-transactions-message" style={{padding: '1rem', margin: 0}}>No hay gastos fijos configurados.</p>}
                        </div>
                        <button onClick={handleAddNew} className="btn-show-add-bank"><PlusIcon /><span>Anadir Gasto Fijo</span></button>
                    </>
                )}
                {modalView === 'form' && (
                     <div className="category-form">
                        <h2>{editingExpense ? 'Editar Gasto Fijo' : 'Nuevo Gasto Fijo'}</h2>
                         <div className="form-group"><label htmlFor="fe-desc">Descripcion</label><input id="fe-desc" type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ej. Alquiler" autoFocus/></div>
                         <div className="form-group"><label htmlFor="fe-amount">Monto</label><input id="fe-amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" min="0.01" step="0.01"/></div>
                         <div className="form-group">
                            <label>Categoria</label>
                            <button type="button" className="custom-select-button" onClick={() => onOpenCategoryModal(setCategory)}>
                                {currentCategoryInfo ? (
                                    <span className="category-display">
                                        <CategoryIcon iconKey={currentCategoryInfo.icon} />
                                        <span>{currentCategoryInfo.name}</span>
                                    </span>
                                ) : (
                                    <span className="placeholder">Seleccionar categoria</span>
                                )}
                                <span className="arrow-down" />
                            </button>
                          </div>
                         {error && <p className="error-message" style={{textAlign: 'center'}}>{error}</p>}
                         <div className="confirmation-dialog-buttons"><button onClick={handleCancel} className="btn-cancel">Cancelar</button><button onClick={handleSave} className="btn-confirm-edit">Guardar</button></div>
                    </div>
                )}
            </div>
        </div>
    );
};

interface CategoriesModalProps {
    isOpen: boolean;
    onClose: () => void;
    categories: Category[];
    expenses: Transaction[];
    onAddCategory: (newCategory: Category) => void;
    onUpdateCategory: (oldName: string, updatedCategory: Category) => void;
    onDeleteCategory: (categoryName: string) => void;
    onSelect: (categoryName: string) => void;
    selectedCategory: string;
    initialView: 'list' | 'select';
}

const CategoriesModal = ({ isOpen, onClose, categories, expenses, onAddCategory, onUpdateCategory, onDeleteCategory, onSelect, selectedCategory, initialView, }: CategoriesModalProps) => {
    const [modalView, setModalView] = useState<'list' | 'select' | 'form'>(initialView);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [name, setName] = useState('');
    const [selectedIcon, setSelectedIcon] = useState('');
    const [error, setError] = useState('');

    const iconKeys = Object.keys(CategoryIcons);

    useEffect(() => {
        if (isOpen) {
            setModalView(initialView);
        } else {
            // Reset state when modal closes
            setTimeout(() => {
                setModalView(initialView);
                setEditingCategory(null);
                setName('');
                setSelectedIcon('');
                setError('');
            }, 300); // Wait for closing animation
        }
    }, [isOpen, initialView]);

    const handleSelect = (categoryName: string) => {
        onSelect(categoryName);
        onClose();
    };
    
    const handleAddNew = () => {
        setEditingCategory(null);
        setName('');
        setSelectedIcon(iconKeys[0]);
        setModalView('form');
        setError('');
    };

    const handleEdit = (category: Category) => {
        setEditingCategory(category);
        setName(category.name);
        setSelectedIcon(category.icon);
        setModalView('form');
        setError('');
    };

    const handleCancelForm = () => {
        setModalView('list');
        setEditingCategory(null);
        setName('');
        setSelectedIcon('');
        setError('');
    };

    const handleDelete = (categoryName: string) => {
        const isUsed = expenses.some(e => e.category === categoryName);
        if (isUsed) {
            alert(`No se puede eliminar la categoria "${categoryName}" porque esta siendo utilizada en uno o mas gastos.`);
            return;
        }
        if (window.confirm(`¿Estas seguro de que quieres eliminar la categoria "${categoryName}"?`)) {
            onDeleteCategory(categoryName);
        }
    };

    const handleSave = () => {
        if (!name.trim()) {
            setError('El nombre de la categoria no puede estar vacio.');
            return;
        }
        const isDuplicate = categories.some(
            c => c.name.toLowerCase() === name.trim().toLowerCase() && c.name !== editingCategory?.name
        );
        if (isDuplicate) {
            setError('Ya existe una categoria con este nombre.');
            return;
        }

        if (editingCategory) {
            onUpdateCategory(editingCategory.name, { name: name.trim(), icon: selectedIcon });
        } else {
            onAddCategory({ name: name.trim(), icon: selectedIcon });
        }
        handleCancelForm();
    };

    if (!isOpen) return null;

    return (
        <div className="bank-modal-overlay category-modal-wrapper" onClick={onClose}>
            <div className="bank-modal manage-categories-modal" onClick={(e) => e.stopPropagation()}>
                {modalView === 'select' && (
                    <>
                        <div className="category-modal-header">
                            <h2>Selecciona una Categoria</h2>
                            <button className="bank-action-btn" onClick={() => setModalView('list')} aria-label="Gestionar categorias"><PencilIcon /></button>
                        </div>
                        <div className="category-picker-grid">
                            {categories.map(category => (
                                <button
                                    key={category.name}
                                    className={`category-picker-item ${selectedCategory === category.name ? 'selected' : ''}`}
                                    onClick={() => handleSelect(category.name)}
                                    aria-label={`Seleccionar categoria ${category.name}`}
                                >
                                    <div className="category-icon-wrapper">
                                        <CategoryIcon iconKey={category.icon} />
                                    </div>
                                    <span>{category.name}</span>
                                </button>
                            ))}
                        </div>
                    </>
                )}
                {modalView === 'list' && (
                    <>
                        <div className="category-modal-header">
                            {initialView === 'select' && <button className="back-btn" onClick={() => setModalView('select')} aria-label="Volver a la seleccion de categorias">&larr;</button>}
                            <h2 style={{ flexGrow: 1, textAlign: 'center' }}>Gestionar Categorias</h2>
                             {initialView === 'select' && <div style={{width: 40, height: 40}}></div> /* Spacer */}
                        </div>

                        <div className="category-management-list">
                            {categories.map(category => (
                                <div key={category.name} className="category-management-item">
                                    <div className="category-info">
                                        <CategoryIcon iconKey={category.icon} />
                                        <span>{category.name}</span>
                                    </div>
                                    <div className="category-actions">
                                        <button className="bank-action-btn" onClick={() => handleEdit(category)} aria-label={`Editar categoria ${category.name}`}><PencilIcon /></button>
                                        <button className="bank-action-btn" onClick={() => handleDelete(category.name)} aria-label={`Eliminar categoria ${category.name}`}><TrashIcon /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button onClick={handleAddNew} className="btn-show-add-bank"><PlusIcon /><span>Crear nueva categoria</span></button>
                    </>
                )}
                {modalView === 'form' && (
                    <>
                        <div className="category-modal-header">
                            <button className="back-btn" onClick={handleCancelForm} aria-label="Volver a la lista de categorias">&larr;</button>
                            <h2 style={{ flexGrow: 1, textAlign: 'center' }}>{editingCategory ? 'Editar Categoria' : 'Nueva Categoria'}</h2>
                        </div>
                        <div className="category-form">
                            <div className="form-group">
                                <label htmlFor="category-name">Nombre</label>
                                <input id="category-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Viajes" autoFocus />
                            </div>
                            <div className="form-group">
                                <label>Icono</label>
                                <div className="icon-picker-grid">
                                    {iconKeys.map(iconKey => (
                                        <button
                                            key={iconKey}
                                            className={`icon-picker-item ${selectedIcon === iconKey ? 'selected' : ''}`}
                                            onClick={() => setSelectedIcon(iconKey)}
                                            aria-label={`Seleccionar icono ${iconKey}`}
                                        >
                                            <CategoryIcon iconKey={iconKey} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {error && <p className="error-message" style={{textAlign: 'center'}}>{error}</p>}
                            <div className="confirmation-dialog-buttons">
                                <button onClick={handleCancelForm} className="btn-cancel">Cancelar</button>
                                <button onClick={handleSave} className="btn-confirm-edit">Guardar</button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);