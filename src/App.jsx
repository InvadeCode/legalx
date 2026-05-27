import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  signInWithPopup 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  updateDoc, 
  onSnapshot, 
  addDoc, 
  query, 
  where, 
  arrayUnion,
  orderBy
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBl4UctOXN6Mq-NYUYQnSvPCWf-tL_gHZU",
  authDomain: "legalx-invadecode.firebaseapp.com",
  projectId: "legalx-invadecode",
  storageBucket: "legalx-invadecode.firebasestorage.app",
  messagingSenderId: "871041702619",
  appId: "1:871041702619:web:298f52d672635c8ce78afe",
  measurementId: "G-MXGY6QTGFZ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const SignaturePad = ({ onSign, disabled, padRef, signatureData }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (padRef) {
      padRef.current = {
        toDataURL: () => canvasRef.current.toDataURL(),
        clear: () => {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (onSign) onSign();
        }
      };
    }
  }, [padRef, onSign]);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.nativeEvent.offsetX || (e.clientX - rect.left), y: e.nativeEvent.offsetY || (e.clientY - rect.top) };
  };

  const startDrawing = (e) => {
    if (disabled || signatureData) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing || disabled || signatureData) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDrawing = (e) => {
    if (disabled || signatureData || !isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);
    if (onSign) onSign();
  };

  if (signatureData) {
    return <img src={signatureData} alt="Signature" className="h-24 object-contain border-b border-zinc-900 w-full" />;
  }

  return (
    <div className="relative border border-zinc-200 rounded-lg overflow-hidden bg-zinc-50 w-full print:hidden">
      <canvas
        ref={canvasRef}
        width={400}
        height={150}
        className={`w-full touch-none ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-crosshair'}`}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={endDrawing}
        onMouseOut={endDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={endDrawing}
      />
      {!disabled && (
        <button 
          onClick={(e) => { e.preventDefault(); padRef?.current?.clear(); }} 
          className="absolute top-2 right-2 text-xs font-medium text-zinc-500 hover:text-black bg-white px-2 py-1 rounded shadow-sm border border-zinc-200"
        >
          Clear
        </button>
      )}
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [activeTab, setActiveTab] = useState('login'); 
  const [activeDocumentId, setActiveDocumentId] = useState(null);
  const [dbError, setDbError] = useState('');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [viewMode, setViewMode] = useState('form'); 
  const [currentStep, setCurrentStep] = useState(1);
  const [newCommentText, setNewCommentText] = useState('');
  const [activeCommentClause, setActiveCommentClause] = useState(null);
  const [adminDashboardView, setAdminDashboardView] = useState('stats');

  const [aiLoading, setAiLoading] = useState(null);
  const [aiExplanations, setAiExplanations] = useState({});
  const [isExporting, setIsExporting] = useState(false);

  const [formData, setFormData] = useState({
    date: '',
    consultantName: '',
    consultantAddress: '',
    timeline: '90', 
    governingLaw: 'Option A', 
    consultantSignature: null,
    adminSignature: null,
    consultantSignatureDate: null,
    adminSignatureDate: null
  });

  const consultantPadRef = useRef();
  const adminPadRef = useRef();
  const isAdmin = user?.email === 'anant@invadecode.com';

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    const pdfScript = document.createElement('script');
    pdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    pdfScript.async = true;
    document.head.appendChild(pdfScript);

    const style = document.createElement('style');
    style.innerHTML = `
      body, html, #root { font-family: 'Poppins', sans-serif !important; }
      @media print {
        @page { size: A4; margin: 20mm; }
        body, html, #root { height: auto !important; overflow: visible !important; background: white; }
        .page-break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
        .print\\:hidden { display: none !important; }
        .print\\:block { display: block !important; }
        .print\\:w-full { width: 100% !important; }
        .print\\:p-0 { padding: 0 !important; }
        .print\\:shadow-none { box-shadow: none !important; }
        .print\\:border-none { border: none !important; }
        .print\\:max-w-none { max-width: none !important; }
      }
      .pdf-document { box-sizing: border-box; overflow: visible !important; }
      .pdf-document * { box-sizing: border-box; }
      .pdf-document p, .pdf-document h1, .pdf-document h2, .pdf-document h3, .pdf-document div { overflow: visible !important; }
      .pdf-document p { break-inside: avoid; page-break-inside: avoid; margin-top: 0; }
      .clause-block { break-inside: avoid; page-break-inside: avoid; }
    `;
    document.head.appendChild(style);

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setActiveTab('dashboard');
      } else {
        setActiveTab('login');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    setDbError('');
    const docsRef = collection(db, 'artifacts', 'legalx', 'public', 'data', 'agreements');
    const q = isAdmin ? query(docsRef) : query(docsRef, where('userEmail', '==', user.email));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docsData = [];
      snapshot.forEach((docSnap) => {
        docsData.push({ id: docSnap.id, ...docSnap.data() });
      });
      docsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setDocuments(docsData);
      setDbError('');
    }, (error) => {
      console.error("Firestore Error in onSnapshot:", error);
      if (error.code === 'permission-denied') {
        setDbError("Database permission denied. Please verify your Firestore rules allow access.");
      } else {
        setDbError("Error loading documents: " + error.message);
      }
    });

    return () => unsubscribe();
  }, [user, isAdmin]);

  const handleAuth = async (e, isLogin) => {
    e.preventDefault();
    setAuthError('');
    setIsSubmitting(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setAuthError('');
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setDocuments([]);
    setActiveDocumentId(null);
  };

  const downloadPDF = async (filename, temporaryData = null) => {
    setIsExporting(true);
    
    if (temporaryData) {
      setFormData(temporaryData);
    }

    // Small delay to let React re-render if temporary data was injected
    setTimeout(async () => {
      const element = document.getElementById('contract-document-container');
      if (!window.html2pdf) {
        window.print();
        setIsExporting(false);
        if (temporaryData) {
          const docData = documents.find(d => d.id === activeDocumentId);
          setFormData(docData?.formData || formData);
        }
        return;
      }

      const opt = {
        margin:       [10, 10, 10, 10], // Adjusted margins
        filename:     filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
          scale: 2, 
          useCORS: true,
          letterRendering: true,
          scrollY: 0,
          windowWidth: element.scrollWidth
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: {
          mode: ['css', 'legacy'],
          avoid: ['p', 'h1', 'h2', 'h3', '.avoid-break', '.clause-block']
        }
      };

      try {
        await window.html2pdf().set(opt).from(element).save();
      } catch (err) {
        console.error("PDF generation failed:", err);
      } finally {
        setIsExporting(false);
        if (temporaryData) {
          const docData = documents.find(d => d.id === activeDocumentId);
          setFormData(docData?.formData || formData);
        }
      }
    }, 200);
  };

  const sendEmail = async (subject, htmlContent) => {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_RESEND_API_KEY}`
        },
        body: JSON.stringify({
          from: 'InvadeCode Legal <invadecodelegal@emails.liaisonit.com>',
          to: 'anant@invadecode.com',
          subject: subject,
          html: htmlContent
        })
      });
    } catch (e) {
      console.error("Email sending failed", e);
    }
  };

  const logTrace = async (docId, action, details) => {
    try {
      const docRef = doc(db, 'artifacts', 'legalx', 'public', 'data', 'agreements', docId);
      await updateDoc(docRef, {
        auditLog: arrayUnion({
          timestamp: new Date().toISOString(),
          user: user.email,
          action: action,
          details: details
        })
      });
    } catch (err) {
      console.error("Failed to log trace:", err);
    }
  };

  const handleStartNew = async () => {
    try {
      setDbError('');
      const initialFormData = {
        date: '',
        consultantName: '',
        consultantAddress: '',
        timeline: '90',
        governingLaw: 'Option A',
        consultantSignature: null,
        adminSignature: null,
        consultantSignatureDate: null,
        adminSignatureDate: null
      };

      const docRef = await addDoc(collection(db, 'artifacts', 'legalx', 'public', 'data', 'agreements'), {
        userId: user.uid,
        userEmail: user.email,
        createdAt: new Date().toISOString(),
        status: 'DRAFTING',
        formData: initialFormData,
        comments: {},
        auditLog: [{
          timestamp: new Date().toISOString(),
          user: user.email,
          action: 'Document Drafted',
          details: 'New agreement initialized.'
        }]
      });
      setActiveDocumentId(docRef.id);
      setFormData(initialFormData);
      setCurrentStep(1);
      setActiveTab('document');
      setViewMode('form');
    } catch (err) {
      console.error("Error creating document:", err);
      setDbError("Failed to create document: " + err.message);
    }
  };

  const handleSaveField = async (field, value) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    
    if (activeDocumentId) {
      try {
        const docRef = doc(db, 'artifacts', 'legalx', 'public', 'data', 'agreements', activeDocumentId);
        await updateDoc(docRef, { [`formData.${field}`]: value });
      } catch (err) {
        console.error("Error saving field:", err);
      }
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim() || !activeDocumentId || !activeCommentClause) return;

    const currentDoc = documents.find(d => d.id === activeDocumentId);
    const updatedComments = { ...(currentDoc.comments || {}) };
    if (!updatedComments[activeCommentClause]) {
      updatedComments[activeCommentClause] = [];
    }
    
    updatedComments[activeCommentClause].push({
      id: Date.now().toString(),
      user: user.email,
      text: newCommentText,
      timestamp: new Date().toISOString()
    });
    
    try {
      const docRef = doc(db, 'artifacts', 'legalx', 'public', 'data', 'agreements', activeDocumentId);
      await updateDoc(docRef, { comments: updatedComments });
      await logTrace(activeDocumentId, 'Comment Added', `Comment on clause: ${activeCommentClause}`);
      setNewCommentText('');
    } catch (err) {
      console.error("Error adding comment:", err);
    }
  };

  const generateAIExplanation = async (clauseId, title) => {
    if (aiExplanations[clauseId]) return; 
    setAiLoading(clauseId);
    try {
      const prompt = `You are an expert legal assistant. Explain the standard legal clause titled "${title}" in the context of an Independent Business Development Consultant Agreement. Keep it under 3 sentences, simple enough for a non-lawyer to understand.`;
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
      const payload = { contents: [{ parts: [{ text: prompt }] }] };
      
      const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (text) {
        setAiExplanations(prev => ({ ...prev, [clauseId]: text }));
      }
    } catch (err) {
      console.error("AI Explanation Error:", err);
    }
    setAiLoading(null);
  };

  const generateAICommentReply = async (e) => {
    e.preventDefault();
    if (!activeCommentClause) return;
    setAiLoading('comment');
    try {
      const currentDoc = documents.find(d => d.id === activeDocumentId);
      const clauseComments = currentDoc?.comments?.[activeCommentClause] || [];
      const history = clauseComments.map(c => `${c.user}: ${c.text}`).join('\n');
      
      const prompt = `You are a professional legal negotiator. Review the following comment history between a consultant and a company regarding Clause ${activeCommentClause}:\n\n${history}\n\nSuggest a professional response, clarification, or a compromise. Provide ONLY the suggested response text without quotes or preamble.`;
      const apiKey = ""; 
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
      const payload = { contents: [{ parts: [{ text: prompt }] }] };
      
      const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (text) {
        setNewCommentText(text.replace(/^"|"$/g, '').trim());
      }
    } catch (err) {
      console.error("AI Reply Error:", err);
    }
    setAiLoading(null);
  };

  const handleConsultantSign = async () => {
    if (!consultantPadRef.current) return;
    const dataURL = consultantPadRef.current.toDataURL();
    const today = new Date().toLocaleDateString();
    
    try {
      const newFormData = { ...formData, consultantSignature: dataURL, consultantSignatureDate: today };
      const docRef = doc(db, 'artifacts', 'legalx', 'public', 'data', 'agreements', activeDocumentId);
      await updateDoc(docRef, {
        'formData.consultantSignature': dataURL,
        'formData.consultantSignatureDate': today,
        status: 'AWAITING_COUNTERSIGNATURE'
      });
      
      setFormData(newFormData);
      await logTrace(activeDocumentId, 'Consultant Signed', 'Document submitted for counter-signature.');
      
      await sendEmail(
        `Action Required: New LegalX Agreement from ${formData.consultantName}`,
        `<p>A new Independent Business Development Consultant Agreement has been signed and is awaiting your counter-signature.</p><p><b>Consultant:</b> ${formData.consultantName}</p><p><b>Email:</b> ${user.email}</p><p>Please log in to the LegalX Dashboard to review and sign.</p>`
      );
    } catch (err) {
      console.error("Error signing document:", err);
    }
  };

  const handleAdminSign = async () => {
    if (!adminPadRef.current) return;
    const dataURL = adminPadRef.current.toDataURL();
    const today = new Date().toLocaleDateString();
    
    try {
      const newFormData = { ...formData, adminSignature: dataURL, adminSignatureDate: today };
      const docRef = doc(db, 'artifacts', 'legalx', 'public', 'data', 'agreements', activeDocumentId);
      await updateDoc(docRef, {
        'formData.adminSignature': dataURL,
        'formData.adminSignatureDate': today,
        status: 'FINALIZED'
      });
      
      setFormData(newFormData);
      await logTrace(activeDocumentId, 'Admin Countersigned', 'Document finalized and locked.');
    } catch (err) {
      console.error("Error counter-signing document:", err);
    }
  };

  const isStepComplete = (step) => {
    switch(step) {
      case 1: return formData.date?.trim() !== '';
      case 2: return formData.consultantName?.trim() !== '';
      case 3: return formData.consultantAddress?.trim() !== '';
      case 4: return formData.timeline?.trim() !== '';
      case 5: return formData.governingLaw?.trim() !== '';
      default: return true;
    }
  };

  const calculateProgress = () => {
    let completed = 0;
    if (formData.date?.trim() !== '') completed++;
    if (formData.consultantName?.trim() !== '') completed++;
    if (formData.consultantAddress?.trim() !== '') completed++;
    return Math.round((completed / 3) * 100);
  };

  const ClauseHeader = ({ title, clauseId }) => {
    const currentDoc = documents.find(d => d.id === activeDocumentId);
    const hasComments = currentDoc?.comments && currentDoc.comments[clauseId] && currentDoc.comments[clauseId].length > 0;

    return (
      <div className="mb-2 mt-6 page-break-inside-avoid">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-zinc-900">{title}</h3>
          <div className="print:hidden flex items-center gap-2">
            <button 
              onClick={() => generateAIExplanation(clauseId, title)}
              disabled={aiLoading === clauseId}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors disabled:opacity-50"
            >
              {aiLoading === clauseId ? '...' : '✨ AI Explain'}
            </button>
            <button 
              onClick={() => setActiveCommentClause(clauseId)}
              className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border transition-colors ${hasComments ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm' : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'}`}
            >
              💬 Comment {hasComments && <span className="ml-1 bg-blue-600 text-white rounded-full px-1.5 py-0.5 text-[8px] font-bold">{currentDoc.comments[clauseId].length}</span>}
            </button>
          </div>
        </div>
        {aiExplanations[clauseId] && (
          <div className="mt-2 mb-4 p-3 bg-gradient-to-r from-purple-50 to-white border border-purple-100 rounded-lg text-[10.5px] leading-relaxed text-zinc-800 shadow-sm relative print:hidden">
             <button onClick={() => setAiExplanations(prev => { const newObj = {...prev}; delete newObj[clauseId]; return newObj; })} className="absolute top-2 right-2 text-purple-300 hover:text-purple-600">×</button>
             <strong className="text-purple-800">✨ AI Explanation:</strong> {aiExplanations[clauseId]}
          </div>
        )}
      </div>
    );
  };

  const renderAuth = () => (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 font-['Poppins']">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-zinc-200 w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="w-10 h-10 bg-black rounded flex items-center justify-center"><span className="text-white font-bold text-xl">L</span></div>
        </div>
        <h2 className="text-2xl font-semibold text-center text-zinc-900 mb-2">
          {activeTab === 'login' ? 'Welcome back' : 'Create an account'}
        </h2>
        <p className="text-center text-zinc-500 mb-8 text-sm">
          {activeTab === 'login' ? 'Enter your details to access your dashboard.' : 'Sign up to draft your contracts.'}
        </p>

        {authError && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{authError}</div>}

        <form onSubmit={(e) => handleAuth(e, activeTab === 'login')}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-zinc-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-black focus:outline-none" required />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-700 mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border border-zinc-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-black focus:outline-none" required />
          </div>
          <button type="submit" disabled={isSubmitting} className="w-full bg-zinc-900 text-white font-medium py-3 rounded-lg hover:bg-black transition-colors mb-4 disabled:opacity-50">
            {activeTab === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="relative flex items-center justify-center mb-6 mt-2">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-200"></div></div>
          <div className="relative bg-white px-4 text-xs uppercase text-zinc-400 font-semibold">Or</div>
        </div>

        <button onClick={handleGoogleSignIn} className="w-full bg-white border border-zinc-200 text-zinc-700 font-medium py-3 rounded-lg hover:bg-zinc-50 flex items-center justify-center gap-3 shadow-sm mb-6">
          <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
          Sign in with Google
        </button>

        <div className="text-center text-sm text-zinc-500">
          {activeTab === 'login' ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => setActiveTab(activeTab === 'login' ? 'register' : 'login')} className="text-black font-semibold hover:underline">
            {activeTab === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="min-h-screen bg-zinc-50 font-['Poppins']">
      <nav className="bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black rounded flex items-center justify-center"><span className="text-white font-bold text-sm">L</span></div>
          <span className="font-bold text-lg tracking-tight">LegalX <span className="text-zinc-400 font-medium text-xs ml-1 uppercase">by InvadeCode</span></span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-zinc-600">{user.email} {isAdmin && <span className="ml-2 bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider">Admin</span>}</span>
          <button onClick={handleLogout} className="text-sm font-medium text-zinc-500 hover:text-black transition-colors">Sign out</button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-8 mt-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{isAdmin ? 'Admin Dashboard' : 'Your Agreements'}</h1>
            <p className="text-zinc-500 mt-1">{isAdmin ? 'Monitor and manage platform agreements.' : 'Manage and track the status of consultant contracts.'}</p>
          </div>
          
          <div className="flex items-center gap-4">
            {isAdmin && (
              <div className="flex bg-zinc-200/60 p-1 rounded-lg mr-2">
                <button onClick={() => setAdminDashboardView('stats')} className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${adminDashboardView === 'stats' ? 'bg-white shadow-sm text-black' : 'text-zinc-500 hover:text-black'}`}>Overview</button>
                <button onClick={() => setAdminDashboardView('advanced')} className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${adminDashboardView === 'advanced' ? 'bg-white shadow-sm text-black' : 'text-zinc-500 hover:text-black'}`}>Advanced View</button>
              </div>
            )}
            <button onClick={handleStartNew} className="bg-black text-white font-medium px-5 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors shadow-sm flex items-center gap-2">
              New Agreement
            </button>
          </div>
        </div>

        {dbError && <div className="mb-8 p-4 bg-red-50 text-red-800 border border-red-200 rounded-lg">{dbError}</div>}

        {isAdmin && adminDashboardView === 'stats' ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm flex flex-col"><span className="text-zinc-500 text-sm font-medium mb-2">Total Agreements</span><span className="text-3xl font-bold text-black">{documents.length}</span></div>
            <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm flex flex-col"><span className="text-emerald-600 text-sm font-medium mb-2">Finalized</span><span className="text-3xl font-bold text-black">{documents.filter(d => d.status === 'FINALIZED').length}</span></div>
            <div className="bg-white p-6 rounded-xl border border-amber-200 shadow-sm flex flex-col bg-amber-50/30"><span className="text-amber-700 text-sm font-medium mb-2">Awaiting Signature</span><span className="text-3xl font-bold text-black">{documents.filter(d => d.status === 'AWAITING_COUNTERSIGNATURE').length}</span></div>
            <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm flex flex-col"><span className="text-zinc-500 text-sm font-medium mb-2">In Draft</span><span className="text-3xl font-bold text-black">{documents.filter(d => d.status === 'DRAFTING').length}</span></div>
          </div>
        ) : null}

        {(!isAdmin || adminDashboardView === 'advanced') && (
          <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
            {documents.length === 0 ? (
              <div className="p-12 text-center text-zinc-500">No agreements found. Click "New Agreement" to start.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    <th className="py-3 px-6 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Document Name</th>
                    {isAdmin && <th className="py-3 px-6 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Created By</th>}
                    <th className="py-3 px-6 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                    <th className="py-3 px-6 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Date</th>
                    <th className="py-3 px-6 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {documents.map((doc) => {
                    const statusColors = {
                      'DRAFTING': 'bg-zinc-100 text-zinc-800 border-zinc-200',
                      'AWAITING_COUNTERSIGNATURE': 'bg-amber-100 text-amber-800 border-amber-200',
                      'FINALIZED': 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    };
                    const totalComments = doc.comments ? Object.values(doc.comments).reduce((acc, curr) => acc + curr.length, 0) : 0;
                    return (
                      <tr key={doc.id} className="hover:bg-zinc-50 transition-colors cursor-pointer group" onClick={() => {
                        setActiveDocumentId(doc.id);
                        setFormData(doc.formData);
                        setActiveTab('document');
                      }}>
                        <td className="py-4 px-6">
                          <div className="font-medium text-zinc-900 flex items-center gap-2">
                            {doc.formData?.consultantName || 'Untitled Agreement'}
                            {totalComments > 0 && <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center shadow-sm" title={`${totalComments} comments`}>{totalComments}</span>}
                          </div>
                          <div className="text-sm text-zinc-500">Business Dev. Consultant</div>
                        </td>
                        {isAdmin && <td className="py-4 px-6 text-sm text-zinc-600">{doc.userEmail}</td>}
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border ${statusColors[doc.status]}`}>{doc.status.replace('_', ' ')}</span>
                        </td>
                        <td className="py-4 px-6 text-sm text-zinc-500">{new Date(doc.createdAt).toLocaleDateString()}</td>
                        <td className="py-4 px-6 text-right"><span className="text-sm font-medium text-blue-600 group-hover:text-blue-800 transition-colors">Open</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>
    </div>
  );

  const renderDocumentForm = () => {
    const docData = documents.find(d => d.id === activeDocumentId);
    if (!docData) return null;
    
    const isAwaitingAdmin = docData.status === 'AWAITING_COUNTERSIGNATURE' && isAdmin;
    const isFinalized = docData.status === 'FINALIZED';
    const progress = calculateProgress();

    return (
      <div className="w-[30%] bg-white border-r border-zinc-200 flex flex-col h-screen overflow-y-auto relative z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)] print:hidden font-['Poppins']">
        <div className="p-6 border-b border-zinc-200 flex items-center justify-between sticky top-0 bg-white z-20">
          <button onClick={() => setActiveTab('dashboard')} className="text-sm font-medium text-zinc-500 hover:text-black flex items-center gap-2 transition-colors">
            ← Dashboard
          </button>
          {isAdmin && (
            <div className="flex bg-zinc-100 p-1 rounded-lg">
              <button onClick={() => setViewMode('form')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'form' ? 'bg-white shadow-sm text-black' : 'text-zinc-500'}`}>Details</button>
              <button onClick={() => setViewMode('audit')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'audit' ? 'bg-white shadow-sm text-black' : 'text-zinc-500'}`}>Trace Log</button>
            </div>
          )}
        </div>

        {viewMode === 'audit' && isAdmin ? (
          <div className="p-6 flex-1 bg-zinc-50/50">
            <h3 className="text-xl font-bold tracking-tight text-zinc-900 mb-6">Traceability Log</h3>
            <div className="space-y-4">
              {docData.auditLog && [...docData.auditLog].reverse().map((log, index) => (
                <div key={index} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-800 mt-1.5 shrink-0"></div>
                    {index !== docData.auditLog.length - 1 && <div className="w-px h-full bg-zinc-200 my-1"></div>}
                  </div>
                  <div className="flex-1 pb-6">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="font-semibold text-zinc-900 text-sm">{log.action}</span>
                      <span className="text-xs text-zinc-500 font-medium whitespace-nowrap ml-2">
                        {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 mb-2">{log.user}</div>
                    {log.details && <div className="bg-white p-3 rounded-lg border border-zinc-200 text-xs text-zinc-700 leading-relaxed shadow-sm mt-1">{log.details}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="p-8 flex-1">
              {!isFinalized && !isAwaitingAdmin && docData.status === 'DRAFTING' && !isAdmin && (
                <div className="mb-10">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                    <span>Completion</span>
                    <span className="text-black">{progress}%</span>
                  </div>
                  <div className="w-full bg-zinc-100 rounded-full h-1.5">
                    <div className="bg-black h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                  </div>
                </div>
              )}

              {isFinalized ? (
                <div className="flex flex-col items-center justify-center h-full text-center mt-20">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-900 mb-2">Agreement Finalized</h2>
                  <p className="text-zinc-500 mb-8 leading-relaxed">This contract has been signed by both parties and is legally binding.</p>
                  <button 
                    onClick={() => {
                      logTrace(activeDocumentId, 'Exported PDF', 'Finalized document downloaded.');
                      downloadPDF(`LegalX_Agreement_${formData.consultantName?.replace(/\s+/g, '_') || 'Final'}.pdf`);
                    }}
                    disabled={isExporting}
                    className="w-full bg-black text-white font-medium py-3 px-6 rounded-lg hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {isExporting ? 'Generating PDF...' : 'Download PDF'}
                  </button>
                </div>
              ) : isAwaitingAdmin ? (
                <div className="flex flex-col h-full justify-center">
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-900 mb-2">Admin Countersignature</h2>
                  <p className="text-zinc-500 mb-8 leading-relaxed">The consultant has signed. Review the document and apply your signature to finalize.</p>
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-zinc-700 mb-2">Your Signature</label>
                    <SignaturePad padRef={adminPadRef} />
                  </div>
                  <button onClick={handleAdminSign} className="w-full bg-black text-white font-medium py-3 px-6 rounded-lg hover:bg-zinc-800 transition-colors">
                    Counter-sign & Finalize
                  </button>
                </div>
              ) : docData.status === 'DRAFTING' && isAdmin ? (
                 <div className="flex flex-col items-center justify-center h-full text-center mt-20">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-900 mb-2">Consultant is Drafting</h2>
                  <p className="text-zinc-500 mb-8 leading-relaxed">The consultant is currently filling out the necessary information for this agreement. You will be notified when it is ready for counter-signature.</p>
                </div>
              ) : docData.status === 'AWAITING_COUNTERSIGNATURE' ? (
                <div className="flex flex-col items-center justify-center h-full text-center mt-20">
                  <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
                    <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-900 mb-2">Awaiting Counter-Signature</h2>
                  <p className="text-zinc-500 mb-8 leading-relaxed">Your signed agreement has been submitted to InvadeCode. We will notify you once it's finalized.</p>
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4">Step {currentStep} of 5</div>
                  
                  {currentStep === 1 && (
                    <>
                      <h2 className="text-3xl font-bold tracking-tight text-zinc-900 mb-4">Agreement Date</h2>
                      <p className="text-zinc-500 mb-8 leading-relaxed text-sm">On what date is this Independent Business Development Consultant Agreement entered into?</p>
                      <input type="date" value={formData.date} onChange={(e) => handleSaveField('date', e.target.value)} className="w-full border border-zinc-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black" />
                    </>
                  )}

                  {currentStep === 2 && (
                    <>
                      <h2 className="text-3xl font-bold tracking-tight text-zinc-900 mb-4">Consultant Details</h2>
                      <p className="text-zinc-500 mb-8 leading-relaxed text-sm">Enter the full legal name of the Consultant.</p>
                      <input type="text" placeholder="e.g. John Doe" value={formData.consultantName} onChange={(e) => handleSaveField('consultantName', e.target.value)} className="w-full border border-zinc-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black" />
                    </>
                  )}

                  {currentStep === 3 && (
                    <>
                      <h2 className="text-3xl font-bold tracking-tight text-zinc-900 mb-4">Consultant Address</h2>
                      <p className="text-zinc-500 mb-8 leading-relaxed text-sm">Enter the full residential or registered address of the Consultant.</p>
                      <textarea rows="3" placeholder="e.g. 123 Tech Lane, San Francisco, CA 94105, USA" value={formData.consultantAddress} onChange={(e) => handleSaveField('consultantAddress', e.target.value)} className="w-full border border-zinc-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black resize-none" />
                    </>
                  )}

                  {currentStep === 4 && (
                    <>
                      <h2 className="text-3xl font-bold tracking-tight text-zinc-900 mb-4">Success Milestone Timeline</h2>
                      <p className="text-zinc-500 mb-8 leading-relaxed text-sm">How many days does the Consultant have to bring three qualifying projects?</p>
                      <select value={formData.timeline} onChange={(e) => handleSaveField('timeline', e.target.value)} className="w-full border border-zinc-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black appearance-none bg-white">
                        <option value="90">90 days</option>
                        <option value="120">120 days</option>
                        <option value="180">180 days</option>
                      </select>
                    </>
                  )}

                  {currentStep === 5 && (
                    <>
                      <h2 className="text-3xl font-bold tracking-tight text-zinc-900 mb-4">Review & Sign</h2>
                      <p className="text-zinc-500 mb-8 leading-relaxed text-sm">Please review the generated document on the right. If everything is correct, provide your signature below to submit.</p>
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-zinc-700 mb-2">Consultant Signature</label>
                        <SignaturePad padRef={consultantPadRef} disabled={false} />
                      </div>
                      <p className="text-xs text-zinc-500 text-center mb-6">Upon submission, this will be securely sent to InvadeCode for counter-signature.</p>
                    </>
                  )}
                </div>
              )}
            </div>
            
            {!isFinalized && !isAwaitingAdmin && docData.status === 'DRAFTING' && !isAdmin && (
              <div className="p-6 bg-zinc-50 border-t border-zinc-200 sticky bottom-0 flex gap-4 mt-auto">
                {currentStep > 1 && (
                  <button onClick={() => setCurrentStep(prev => prev - 1)} className="font-medium py-3 px-6 rounded-lg text-zinc-500 hover:text-black hover:bg-zinc-100 transition-colors">Previous</button>
                )}
                {currentStep < 5 ? (
                  <button onClick={() => { if (isStepComplete(currentStep)) setCurrentStep(prev => prev + 1); }} disabled={!isStepComplete(currentStep)} className="flex-1 bg-black text-white font-medium py-3 px-6 rounded-lg hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                    Continue &gt;
                  </button>
                ) : (
                  <button onClick={handleConsultantSign} className="flex-1 bg-black text-white font-medium py-3 px-6 rounded-lg hover:bg-zinc-800 transition-colors shadow-lg">
                    Submit for Signature
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderDocumentPreview = () => {
    const docData = documents.find(d => d.id === activeDocumentId);
    if (!docData) return null;

    const DateDisplay = formData.date ? new Date(formData.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : <span className="bg-amber-100 text-amber-800 px-1 rounded inline-block border border-amber-200 print:bg-transparent print:border-none print:text-black">[{formData.date || 'Date'}]</span>;
    const NameDisplay = formData.consultantName || <span className="bg-amber-100 text-amber-800 px-1 rounded inline-block border border-amber-200 print:bg-transparent print:border-none print:text-black">[{formData.consultantName || 'Consultant Full Name'}]</span>;
    const AddressDisplay = formData.consultantAddress || <span className="bg-amber-100 text-amber-800 px-1 rounded inline-block border border-amber-200 print:bg-transparent print:border-none print:text-black">[{formData.consultantAddress || 'Address, California, USA'}]</span>;
    const TimelineDisplay = formData.timeline || <span className="bg-amber-100 text-amber-800 px-1 rounded inline-block border border-amber-200 print:bg-transparent print:border-none print:text-black">[{formData.timeline || '90'}]</span>;

    const emptyTemplateData = { date: '', consultantName: '', consultantAddress: '', timeline: '', governingLaw: '', consultantSignature: null, adminSignature: null, consultantSignatureDate: null, adminSignatureDate: null };

    return (
      <div className="w-[70%] h-screen print:h-auto overflow-y-auto print:overflow-visible bg-zinc-100/80 p-[2%] print:w-full print:p-0 print:block print:bg-white relative font-['Poppins']">
        <div className="absolute top-6 right-12 print:hidden z-10 flex gap-4">
           {docData.status === 'FINALIZED' && (
             <button onClick={() => downloadPDF(`LegalX_Agreement_${formData.consultantName?.replace(/\s+/g, '_') || 'Final'}.pdf`)} disabled={isExporting} className="bg-black text-white px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-sm flex items-center gap-2 disabled:opacity-70">
                {isExporting ? 'Generating PDF...' : 'Export PDF'}
              </button>
           )}
           <button onClick={() => {
              logTrace(activeDocumentId, 'Downloaded Blank Template', 'Blank template exported.');
              downloadPDF('LegalX_Blank_Agreement_Template.pdf', emptyTemplateData);
            }} disabled={isExporting} className="text-zinc-600 hover:text-black bg-white border border-zinc-200 px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-sm disabled:opacity-70">
              {isExporting ? 'Generating...' : 'Export Blank Template'}
            </button>
        </div>

        <div id="contract-document-container" className="max-w-[794px] mx-auto bg-white border border-zinc-200 shadow-sm rounded-xl px-[14mm] py-[14mm] min-h-[1123px] text-[11px] leading-[1.65] text-zinc-900 print:border-none print:shadow-none print:p-0 print:max-w-none print:w-full text-justify pdf-document">
          
          <h1 className="text-center font-bold text-[14px] uppercase tracking-wider mb-6">INDEPENDENT BUSINESS DEVELOPMENT CONSULTANT AGREEMENT</h1>
          <p className="mb-6">This Independent Business Development Consultant Agreement “Agreement” is entered into on {DateDisplay}.</p>
          
          <p className="font-bold mb-2">BETWEEN</p>
          <p className="mb-6">Invade Code Limited, a company incorporated under the laws of India, having its principal office at Level 2, Tower 4, WTC, Kharadi, Pune, MH - 411014, hereinafter referred to as “Company” or “Invade Code”.</p>
          
          <p className="font-bold mb-2">AND</p>
          <p className="mb-6">{NameDisplay}, residing at {AddressDisplay}, hereinafter referred to as “Consultant”.</p>
          
          <p className="mb-8">The Company and the Consultant may individually be referred to as a “Party” and collectively as the “Parties”.</p>

          <div className="clause-block">
            <ClauseHeader title="1. Background" clauseId="1" />
            <p className="mb-2">1.1. Invade Code is an India-based technology, AI, cloud, ERP, CRM, automation, and digital solutions company. The Company designs, develops, implements, hosts, manages, and supports technology platforms and solutions for clients across sectors.</p>
            <p className="mb-2">1.2. The Company’s capabilities include, but are not limited to:</p>
            <div className="pl-4 mb-2 space-y-1">
              <p>a. AI-led ERP and CRM platforms;</p>
              <p>b. cloud-native business tools;</p>
              <p>c. custom enterprise applications;</p>
              <p>d. workflow automation systems;</p>
              <p>e. client-specific business intelligence tools;</p>
              <p>f. cloud-hosted solutions operated by the Company;</p>
              <p>g. implementation of Company-built solutions within client-owned infrastructure;</p>
              <p>h. integrations with third-party enterprise systems;</p>
              <p>i. technology consulting, discovery, solution architecture, implementation, and managed support.</p>
            </div>
            <p className="mb-2">1.3. The Consultant is based in California, United States, and has represented that he/she/they has the experience, network, and capability to identify, introduce, develop, and assist in closing business opportunities for the Company in the United States and/or other agreed territories.</p>
            <p className="mb-6">1.4. The Parties wish to enter into this Agreement under which the Consultant shall initially work on a commission-only basis, with eligibility for a future base pay structure only after achieving the agreed initial success milestone.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="2. Appointment" clauseId="2" />
            <p className="mb-2">2.1. The Company appoints the Consultant as an independent business development consultant for the purpose of identifying, introducing, pursuing, and supporting the closure of qualified technology projects for Invade Code.</p>
            <p className="mb-2">2.2. The Consultant accepts the appointment subject to the terms of this Agreement.</p>
            <p className="mb-2">2.3. This Agreement does not create an employer-employee relationship, partnership, joint venture, franchise, agency, or representative office relationship between the Parties.</p>
            <p className="mb-6">2.4. The Consultant shall not describe himself/herself/themselves as an employee, officer, director, partner, legal agent, or authorized signatory of the Company.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="3. Nature of Engagement" clauseId="3" />
            <p className="mb-2">3.1. The Consultant shall operate as an independent contractor.</p>
            <p className="mb-2">3.2. The Consultant shall control the manner, timing, tools, and methods used to perform the services, subject only to the commercial objectives, brand guidelines, confidentiality obligations, and compliance requirements of the Company.</p>
            <p className="mb-2">3.3. The Consultant shall not be entitled to employee benefits from the Company, including but not limited to health insurance, paid leave, retirement benefits, bonus, provident fund, gratuity, severance, workers’ compensation benefits, or unemployment benefits.</p>
            <p className="mb-2">3.4. The Consultant shall be responsible for all personal, federal, state, local, and international taxes, filings, licenses, permits, insurance, and compliance obligations arising from the compensation received under this Agreement.</p>
            <p className="mb-6">3.5. The Consultant shall not be subject to fixed working hours, daily attendance, or exclusive service obligations, except where separately agreed in writing for a specific client opportunity.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="4. Territory" clauseId="4" />
            <p className="mb-2">4.1. The initial territory shall be California, United States, and such other territories as may be mutually agreed in writing.</p>
            <p className="mb-2">4.2. The Consultant may introduce opportunities outside California only with prior written acknowledgment from the Company.</p>
            <p className="mb-2">4.3. The Company may work with other consultants, partners, agencies, and internal teams in the same or overlapping territories.</p>
            <p className="mb-6">4.4. This Agreement does not grant exclusivity to the Consultant unless specifically agreed in writing.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="5. Scope of Services" clauseId="5" />
            <p className="mb-2">The Consultant shall provide business development and opportunity-generation services, including:</p>
            <div className="pl-4 mb-6 space-y-1">
              <p>a. identifying potential clients, partners, and opportunities;</p>
              <p>b. introducing Invade Code to qualified prospects;</p>
              <p>c. conducting first-level commercial discussions;</p>
              <p>d. understanding client problems and mapping them to Invade Code’s capabilities;</p>
              <p>e. arranging discovery calls, demos, meetings, and presentations;</p>
              <p>f. supporting proposal discussions;</p>
              <p>g. coordinating between the client and Invade Code’s solution, technical, and commercial teams;</p>
              <p>h. assisting in follow-ups and closure;</p>
              <p>i. supporting collection of basic client requirements;</p>
              <p>j. maintaining a clear opportunity pipeline;</p>
              <p>k. sharing meeting notes, decision-maker details, and deal-stage updates;</p>
              <p>l. supporting the Company until the project is formally signed and the first client payment is received.</p>
            </div>
          </div>

          <div className="clause-block">
            <ClauseHeader title="6. Initial Success Milestone" clauseId="6" />
            <p className="mb-2">6.1. The Consultant’s initial success milestone shall be the successful closure of three qualifying client projects for Invade Code.</p>
            <p className="mb-2">6.2. A project shall be considered a “Qualifying Project” only when all of the following conditions are met:</p>
            <div className="pl-4 mb-2 space-y-1">
              <p>a. the opportunity was originally introduced by the Consultant and acknowledged in writing by the Company;</p>
              <p>b. the client was not already in active discussion with the Company, unless specifically approved by the Company;</p>
              <p>c. the client signs a valid agreement, purchase order, statement of work, work order, or equivalent commercial document with the Company;</p>
              <p>d. the project has a clearly defined commercial value;</p>
              <p>e. the first payment from the client is received by the Company;</p>
              <p>f. the project is not cancelled, refunded, disputed, or terminated before commencement due to reasons attributable to misrepresentation by the Consultant.</p>
            </div>
            <p className="mb-2">6.3. The target expectation is that the Consultant shall bring approximately three qualifying projects within {TimelineDisplay} days from the Effective Date.</p>
            <p className="mb-6">6.4. The Company may review the engagement if the Consultant does not produce meaningful qualified pipeline activity within the first 60 days.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="7. Commission Structure" clauseId="7" />
            <p className="mb-2">7.1. During the initial phase, the Consultant shall be compensated only by commission.</p>
            <p className="mb-2">7.2. The Consultant shall be eligible to receive 22% of Gross Profit earned by the Company from each Qualifying Project.</p>
            <p className="mb-2">7.3. For the purpose of this Agreement:<br/>Gross Profit = Project Cost actually received by the Company minus All Expenses directly attributable to the project.</p>
            <p className="mb-2">7.4. “Project Cost” means the total amount actually received by the Company from the client for the relevant project, excluding taxes, statutory deductions, payment gateway charges, bank charges, refunds, write-offs, withheld amounts, penalties, reimbursable pass-through amounts, and unpaid invoices.</p>
            <p className="mb-2">7.5. “All Expenses” may include, but are not limited to:</p>
            <div className="pl-4 mb-2 space-y-1">
              <p>a. internal delivery cost;</p>
              <p>b. developer, designer, architect, QA, project management, DevOps, cloud, infrastructure, or implementation resource cost;</p>
              <p>c. third-party software, API, platform, hosting, cloud, or subscription costs;</p>
              <p>d. subcontractor or vendor cost;</p>
              <p>e. travel, lodging, meeting, visa, documentation, legal, compliance, or client-specific onboarding expenses;</p>
              <p>f. taxes, duties, government levies, and statutory charges where applicable;</p>
              <p>g. payment collection charges, bank transfer charges, currency conversion charges, and forex losses;</p>
              <p>h. sales enablement, demo, proof-of-concept, or pilot costs specifically incurred for that client;</p>
              <p>i. warranty, support, maintenance, and post-delivery costs included in the project scope;</p>
              <p>j. any discounts, credits, refunds, chargebacks, or write-offs.</p>
            </div>
            <p className="mb-2">7.6. The Company shall have the right to determine project expenses in good faith based on internal accounting records.</p>
            <p className="mb-6">7.7. Commission shall be payable only on amounts actually received by the Company, not on signed contract value, invoice value, expected value, pipeline value, or verbal commitments.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="8. Commission Payment Timing" clauseId="8" />
            <p className="mb-2">8.1. Commission shall become eligible only after the Company receives payment from the client.</p>
            <p className="mb-2">8.2. Commission shall be calculated on a payment-received basis.</p>
            <p className="mb-2">8.3. Unless otherwise agreed, commission shall be paid within 30 business days after:</p>
            <div className="pl-4 mb-2 space-y-1">
              <p>a. receipt of client payment by the Company;</p>
              <p>b. reconciliation of project expenses; and</p>
              <p>c. receipt of a valid invoice from the Consultant.</p>
            </div>
            <p className="mb-2">8.4. If a client pays in milestones, commission shall also be calculated and paid in corresponding milestones.</p>
            <p className="mb-2">8.5. If a client delays payment, disputes an invoice, partially pays, deducts amounts, or cancels the project, the Consultant’s commission shall be adjusted accordingly.</p>
            <p className="mb-6">8.6. If the Company has already paid commission and the corresponding client amount is later refunded, reversed, written off, or clawed back, the Company may deduct or adjust such amount from future commission payable to the Consultant.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="9. Example Commission Calculation" clauseId="9" />
            <p className="mb-2">For clarity only:</p>
            <table className="w-full text-left border-collapse my-4 border border-zinc-200">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200">
                  <th className="p-3 border-r border-zinc-200 font-semibold text-zinc-900">Particulars</th>
                  <th className="p-3 font-semibold text-zinc-900">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-zinc-200">
                  <td className="p-3 border-r border-zinc-200">Client project value received by Company</td>
                  <td className="p-3">USD 100,000</td>
                </tr>
                <tr className="border-b border-zinc-200">
                  <td className="p-3 border-r border-zinc-200">Less: direct project expenses</td>
                  <td className="p-3">USD 60,000</td>
                </tr>
                <tr className="border-b border-zinc-200 font-bold bg-zinc-50">
                  <td className="p-3 border-r border-zinc-200">Gross Profit</td>
                  <td className="p-3">USD 40,000</td>
                </tr>
                <tr>
                  <td className="p-3 border-r border-zinc-200 font-medium">Consultant commission @ 22% of Gross Profit</td>
                  <td className="p-3 font-medium">USD 8,800</td>
                </tr>
              </tbody>
            </table>
            <p className="mb-6 text-zinc-500 italic text-[10px]">The above is only an illustration and shall not be treated as a guaranteed earning.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="10. Future Base Pay Structure" clauseId="10" />
            <p className="mb-2">10.1. The Consultant shall become eligible for discussion of a base pay structure only after successfully closing three Qualifying Projects.</p>
            <p className="mb-2">10.2. The base pay structure may include:</p>
            <div className="pl-4 mb-2 space-y-1">
              <p>a. fixed monthly retainer;</p>
              <p>b. reduced commission percentage;</p>
              <p>c. performance-linked incentive;</p>
              <p>d. territory-specific targets;</p>
              <p>e. minimum monthly activity commitments;</p>
              <p>f. quarterly revenue or gross profit targets.</p>
            </div>
            <p className="mb-2">10.3. No base pay, salary, retainer, allowance, draw, advance, reimbursement, or guaranteed compensation shall be payable unless agreed in a separate written amendment signed by both Parties.</p>
            <p className="mb-6">10.4. The Company shall not be obligated to offer a base pay structure merely because the Consultant has introduced opportunities. Eligibility shall arise only after three Qualifying Projects are closed and paid.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="11. Lead Registration and Ownership" clauseId="11" />
            <p className="mb-2">11.1. The Consultant must register each lead with the Company in writing by email or through a Company-approved CRM or pipeline tracker.</p>
            <p className="mb-2">11.2. Lead registration must include:</p>
            <div className="pl-4 mb-2 space-y-1">
              <p>a. company name;</p>
              <p>b. website;</p>
              <p>c. location;</p>
              <p>d. decision-maker name;</p>
              <p>e. designation;</p>
              <p>f. email and contact number, where available;</p>
              <p>g. source of introduction;</p>
              <p>h. business problem or opportunity;</p>
              <p>i. expected project value, if known;</p>
              <p>j. current status and next step.</p>
            </div>
            <p className="mb-2">11.3. The Company shall confirm whether the lead is accepted, rejected, already known, or subject to further review.</p>
            <p className="mb-2">11.4. Commission shall not be payable on unregistered leads unless the Company specifically approves the lead in writing.</p>
            <p className="mb-6">11.5. If two or more consultants introduce the same opportunity, the Company shall determine attribution in good faith based on timestamp, contribution, quality of introduction, and role in deal closure.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="12. Client Communication and Authority" clauseId="12" />
            <p className="mb-2">12.1. The Consultant may introduce the Company and facilitate commercial discussions.</p>
            <p className="mb-2">12.2. The Consultant shall not make binding commitments on behalf of the Company.</p>
            <p className="mb-2">12.3. The Consultant shall not approve pricing, discounts, delivery timelines, technical commitments, contractual terms, data security commitments, service levels, warranties, indemnities, or legal terms without written approval from the Company.</p>
            <p className="mb-2">12.4. All final proposals, statements of work, contracts, pricing, delivery commitments, and scope documents shall be issued only by the Company or its authorized representative.</p>
            <p className="mb-6">12.5. The Consultant shall not collect money from clients on behalf of the Company unless specifically authorized in writing.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="13. Performance Expectations" clauseId="13" />
            <p className="mb-2">The Consultant is expected to:</p>
            <div className="pl-4 mb-6 space-y-1">
              <p>a. maintain a professional pipeline of qualified prospects;</p>
              <p>b. focus on meaningful business opportunities rather than generic introductions;</p>
              <p>c. prioritize decision-maker-level meetings;</p>
              <p>d. understand the client’s business problem before positioning a solution;</p>
              <p>e. avoid overpromising or misrepresenting Invade Code’s capabilities;</p>
              <p>f. provide timely meeting updates;</p>
              <p>g. support proposal follow-ups;</p>
              <p>h. maintain professional communication standards;</p>
              <p>i. protect the Company’s brand, credibility, and commercial interest.</p>
            </div>
          </div>

          <div className="clause-block">
            <ClauseHeader title="14. Company Responsibilities" clauseId="14" />
            <p className="mb-2">The Company shall reasonably support the Consultant by providing:</p>
            <div className="pl-4 mb-2 space-y-1">
              <p>a. company profile;</p>
              <p>b. pitch decks;</p>
              <p>c. case studies, where appropriate;</p>
              <p>d. solution capability notes;</p>
              <p>e. technical pre-sales support;</p>
              <p>f. proposal support;</p>
              <p>g. pricing inputs;</p>
              <p>h. demo support, where applicable;</p>
              <p>i. client meeting participation;</p>
              <p>j. contract and SOW drafting support.</p>
            </div>
            <p className="mb-6">The Company’s support shall be subject to availability, internal priorities, and opportunity quality.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="15. Expenses" clauseId="15" />
            <p className="mb-2">15.1. The Consultant shall bear his/her/their own operating expenses unless otherwise approved in writing by the Company.</p>
            <p className="mb-2">15.2. Any reimbursable expense must be pre-approved in writing.</p>
            <p className="mb-2">15.3. Reimbursement shall require valid receipts, purpose, client/opportunity reference, and Company approval.</p>
            <p className="mb-6">15.4. Unapproved expenses shall not be reimbursed.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="16. Confidentiality" clauseId="16" />
            <p className="mb-2">16.1. The Consultant may receive confidential information relating to the Company, its clients, proposals, pricing, technology, architecture, product roadmap, financials, business plans, source code, documentation, credentials, cloud infrastructure, sales strategy, and internal processes.</p>
            <p className="mb-2">16.2. The Consultant shall keep all confidential information strictly confidential and shall not disclose it to any third party without prior written consent.</p>
            <p className="mb-2">16.3. Confidential information shall be used only for the purpose of performing services under this Agreement.</p>
            <p className="mb-2">16.4. The Consultant shall not copy, download, store, forward, publish, or misuse confidential information.</p>
            <p className="mb-6">16.5. The confidentiality obligations shall continue for five years after termination of this Agreement. Trade secrets shall remain protected for as long as they remain trade secrets under applicable law.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="17. Intellectual Property" clauseId="17" />
            <p className="mb-2">17.1. All intellectual property owned, created, developed, licensed, or used by Invade Code shall remain the exclusive property of Invade Code.</p>
            <p className="mb-2">17.2. The Consultant shall not acquire any ownership rights in the Company’s technology, products, platforms, software, documentation, proposals, decks, code, architecture, brand assets, or client deliverables.</p>
            <p className="mb-2">17.3. Any material created by the Consultant specifically for the Company, including lead notes, sales documentation, client requirement notes, proposal inputs, market notes, and pipeline reports, shall be the property of the Company upon creation, to the extent legally permissible.</p>
            <p className="mb-6">17.4. The Consultant shall not reuse Company-created material for any third party without written approval.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="18. Brand and Marketing Use" clauseId="18" />
            <p className="mb-2">18.1. The Consultant may use approved Company material only for agreed business development activities.</p>
            <p className="mb-2">18.2. The Consultant shall not use the Company’s logo, brand name, website, deck, case study, client name, or credentials in public marketing, social media, events, directories, or third-party platforms without written approval.</p>
            <p className="mb-6">18.3. The Consultant shall not represent that he/she/they owns, operates, controls, or manages Invade Code or its solutions.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="19. Non-Circumvention" clauseId="19" />
            <p className="mb-2">19.1. The Consultant shall not bypass the Company and directly contract with a client introduced to the Company for the same or similar services.</p>
            <p className="mb-2">19.2. The Consultant shall not divert a Company opportunity to another technology vendor, developer, agency, software provider, or competing business.</p>
            <p className="mb-2">19.3. The Consultant shall not encourage clients to terminate, reduce, delay, or avoid engagement with the Company.</p>
            <p className="mb-6">19.4. This clause shall survive for 24 months after termination of this Agreement.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="20. Non-Solicitation" clauseId="20" />
            <p className="mb-2">20.1. During the term of this Agreement and for 12 months thereafter, the Consultant shall not knowingly solicit the Company’s employees, contractors, vendors, delivery partners, or active clients for competing business.</p>
            <p className="mb-2">20.2. This clause shall be interpreted only to the extent permitted by applicable law.</p>
            <p className="mb-6">20.3. Nothing in this Agreement shall restrict lawful general advertising, public job postings, or general market outreach not specifically targeted at the Company’s employees or clients.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="21. No Non-Compete" clauseId="21" />
            <p className="mb-2">21.1. This Agreement does not impose a general non-compete restriction on the Consultant.</p>
            <p className="mb-6">21.2. The Consultant may work with other businesses, provided that he/she/they does not misuse the Company’s confidential information, divert Company opportunities, misrepresent the Company, or create a conflict of interest.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="22. Conflicts of Interest" clauseId="22" />
            <p className="mb-2">22.1. The Consultant shall disclose any actual or potential conflict of interest that may affect his/her/their ability to represent the Company fairly.</p>
            <p className="mb-2">22.2. The Consultant shall not represent a competing vendor for the same opportunity without written disclosure and approval.</p>
            <p className="mb-6">22.3. The Consultant shall not receive hidden commissions, referral fees, kickbacks, gifts, or benefits from clients, vendors, or third parties in relation to Company opportunities.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="23. Compliance" clauseId="23" />
            <p className="mb-2">23.1. The Consultant shall comply with all applicable laws, including anti-bribery, anti-corruption, sanctions, export control, privacy, data protection, and fair business practice laws.</p>
            <p className="mb-2">23.2. The Consultant shall not offer, promise, authorize, or provide any improper payment, gift, advantage, or inducement to any client, government official, employee, vendor, or third party.</p>
            <p className="mb-2">23.3. The Consultant shall comply with applicable U.S., California, Indian, and international business conduct requirements relevant to the services.</p>
            <p className="mb-6">23.4. Any breach of this clause shall be grounds for immediate termination.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="24. Data Protection and Client Information" clauseId="24" />
            <p className="mb-2">24.1. The Consultant shall handle client and prospect information responsibly and only for legitimate business development purposes.</p>
            <p className="mb-2">24.2. The Consultant shall not scrape, purchase, misuse, or unlawfully process personal data.</p>
            <p className="mb-2">24.3. The Consultant shall not upload Company or client data into unauthorized AI tools, personal cloud accounts, public databases, or unapproved third-party systems.</p>
            <p className="mb-6">24.4. Any suspected data breach, unauthorized disclosure, or misuse of information must be reported to the Company immediately.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="25. Term" clauseId="25" />
            <p className="mb-2">25.1. This Agreement shall commence on {DateDisplay} and shall continue for an initial term of six months, unless terminated earlier.</p>
            <p className="mb-6">25.2. The Agreement may be extended by mutual written agreement.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="26. Termination" clauseId="26" />
            <p className="mb-2">26.1. Either Party may terminate this Agreement without cause by giving 15 days’ written notice.</p>
            <p className="mb-2">26.2. The Company may terminate this Agreement immediately if the Consultant:</p>
            <div className="pl-4 mb-2 space-y-1">
              <p>a. breaches confidentiality;</p>
              <p>b. misrepresents the Company;</p>
              <p>c. commits fraud or misconduct;</p>
              <p>d. violates compliance obligations;</p>
              <p>e. diverts or attempts to divert clients;</p>
              <p>f. makes unauthorized commitments;</p>
              <p>g. damages the Company’s reputation;</p>
              <p>h. fails to disclose a conflict of interest;</p>
              <p>i. materially breaches this Agreement.</p>
            </div>
            <p className="mb-6">26.3. On termination, the Consultant shall immediately stop representing the Company and return or delete all Company confidential information, documents, credentials, decks, files, and client data.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="27. Commission After Termination" clauseId="27" />
            <p className="mb-2">27.1. The Consultant shall remain eligible for commission on Qualifying Projects that were:</p>
            <div className="pl-4 mb-2 space-y-1">
              <p>a. registered by the Consultant;</p>
              <p>b. accepted by the Company;</p>
              <p>c. substantially advanced by the Consultant before termination; and</p>
              <p>d. signed by the client within 90 days after termination.</p>
            </div>
            <p className="mb-2">27.2. No commission shall be payable after termination for:</p>
            <div className="pl-4 mb-2 space-y-1">
              <p>a. unregistered leads;</p>
              <p>b. rejected leads;</p>
              <p>c. dormant leads with no meaningful Consultant contribution;</p>
              <p>d. opportunities independently sourced by the Company;</p>
              <p>e. projects signed more than 90 days after termination;</p>
              <p>f. renewals, expansions, upsells, support contracts, or additional scopes unless specifically agreed in writing.</p>
            </div>
            <p className="mb-6">27.3. Commission after termination shall remain subject to actual client payment and gross profit calculation.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="28. Records and Reporting" clauseId="28" />
            <p className="mb-2">28.1. The Consultant shall maintain accurate records of leads, meetings, introductions, client discussions, and pipeline activity.</p>
            <p className="mb-2">28.2. The Company may require periodic pipeline updates in a mutually agreed format.</p>
            <p className="mb-6">28.3. The Consultant shall not falsify, inflate, duplicate, or misrepresent pipeline information.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="29. Audit and Reconciliation" clauseId="29" />
            <p className="mb-2">29.1. The Company shall maintain reasonable internal records of project revenue and expenses for commission calculation.</p>
            <p className="mb-2">29.2. The Consultant may request a summary of commission calculation for a Qualifying Project.</p>
            <p className="mb-2">29.3. The Company shall not be required to disclose confidential employee salaries, vendor agreements, client-sensitive data, internal margins across unrelated projects, or proprietary accounting records.</p>
            <p className="mb-6">29.4. Any commission dispute must be raised within 30 days of receipt of the commission statement. If not raised within that period, the statement shall be deemed accepted.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="30. Limitation of Liability" clauseId="30" />
            <p className="mb-2">30.1. Neither Party shall be liable for indirect, incidental, special, punitive, or consequential damages.</p>
            <p className="mb-2">30.2. The Company’s total liability under this Agreement shall not exceed the unpaid commission properly due to the Consultant for Qualifying Projects.</p>
            <p className="mb-6">30.3. The limitations shall not apply to fraud, confidentiality breach, IP misuse, data breach, wilful misconduct, non-circumvention breach, or compliance violations.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="31. Indemnity" clauseId="31" />
            <p className="mb-2">31.1. The Consultant shall indemnify and hold harmless the Company, its directors, employees, officers, affiliates, and clients from claims, losses, penalties, damages, or expenses arising from:</p>
            <div className="pl-4 mb-6 space-y-1">
              <p>a. Consultant’s breach of this Agreement;</p>
              <p>b. misrepresentation;</p>
              <p>c. unauthorized commitments;</p>
              <p>d. violation of law;</p>
              <p>e. data misuse;</p>
              <p>f. fraud or misconduct;</p>
              <p>g. third-party claims caused by Consultant’s actions.</p>
            </div>
          </div>

          <div className="clause-block">
            <ClauseHeader title="32. Independent Legal and Tax Advice" clauseId="32" />
            <p className="mb-2">32.1. The Consultant acknowledges that he/she/they has had the opportunity to seek independent legal, tax, and financial advice before signing this Agreement.</p>
            <p className="mb-6">32.2. The Consultant shall be responsible for understanding the tax and legal implications of receiving commission from an India-based company.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="33. Notices" clauseId="33" />
            <p className="mb-2">All notices under this Agreement shall be sent by email and/or courier to the addresses below:</p>
            <div className="grid grid-cols-2 gap-4 mb-6 bg-zinc-50 p-4 border border-zinc-200 rounded-md">
              <div>
                <p className="font-bold underline mb-2">For Company:</p>
                <p>Name: Authorized Signatory</p>
                <p>Email: anant@invadecode.com</p>
                <p>Address: Level 2, Tower 4, WTC, Kharadi, Pune, MH - 411014</p>
              </div>
              <div>
                <p className="font-bold underline mb-2">For Consultant:</p>
                <p>Name: {NameDisplay}</p>
                <p>Email: {user?.email || '[Email]'}</p>
                <p>Address: {AddressDisplay}</p>
              </div>
            </div>
          </div>

          <div className="clause-block">
            <ClauseHeader title="34. Governing Law and Dispute Resolution" clauseId="34" />
            <p className="mb-2">34.1. This Agreement shall be governed by the laws of India.</p>
            <p className="mb-2">34.2. Any dispute shall first be resolved through good-faith negotiation between senior representatives of both Parties.</p>
            <p className="mb-2">34.3. If unresolved within 30 days, the dispute shall be referred to arbitration in Pune, Maharashtra, India, in accordance with the Arbitration and Conciliation Act, 1996.</p>
            <p className="mb-2">34.4. The arbitration shall be conducted in English by a sole arbitrator mutually appointed by the Parties.</p>
            <p className="mb-6">34.5. The courts of Pune, Maharashtra, India shall have jurisdiction for interim relief and enforcement.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="35. Entire Agreement" clauseId="35" />
            <p className="mb-2">35.1. This Agreement, including its exhibits, constitutes the entire understanding between the Parties.</p>
            <p className="mb-2">35.2. Any amendment must be in writing and signed by both Parties.</p>
            <p className="mb-6">35.3. Emails, messages, discussions, or verbal assurances shall not modify this Agreement unless expressly incorporated in a signed amendment.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="36. Severability" clauseId="36" />
            <p className="mb-6">If any provision of this Agreement is held invalid or unenforceable, the remaining provisions shall continue in full force.</p>
          </div>

          <div className="clause-block">
            <ClauseHeader title="37. Counterparts and Electronic Signature" clauseId="37" />
            <p className="mb-6">This Agreement may be signed electronically and in counterparts. Electronic signatures shall be treated as original signatures.</p>
          </div>

          <div className="clause-block">
            <p className="font-bold mt-12 mb-6">SIGNATURES</p>
            <div className="grid grid-cols-2 gap-12 mb-12">
              <div>
                <p className="font-bold mb-8">For Invade Code Limited</p>
                {formData.adminSignature ? (
                  <>
                    <img src={formData.adminSignature} alt="Admin Signature" className="h-16 object-contain mb-2 border-b border-zinc-200 w-full mix-blend-multiply" />
                    <p className="font-bold">Authorized Signatory</p>
                    <p className="text-zinc-500">Date: {formData.adminSignatureDate}</p>
                  </>
                ) : (
                  <>
                    <div className="h-16 border-b border-zinc-400 mb-2 flex items-end pb-2">
                      <span className="text-zinc-400 italic">Awaiting Countersignature</span>
                    </div>
                    <p className="font-bold">Authorized Signatory</p>
                    <p className="text-zinc-500">Date: <span className="bg-zinc-100 border border-zinc-200 px-1 rounded">[DATE]</span></p>
                  </>
                )}
              </div>
              <div>
                <p className="font-bold mb-8 uppercase">For {NameDisplay}</p>
                {formData.consultantSignature ? (
                  <>
                    <img src={formData.consultantSignature} alt="Consultant Signature" className="h-16 object-contain mb-2 border-b border-zinc-200 w-full mix-blend-multiply" />
                    <p className="font-bold">Consultant Signature</p>
                    <p className="text-zinc-500">Date: {formData.consultantSignatureDate}</p>
                  </>
                ) : (
                  <>
                    <div className="h-16 border-b border-zinc-400 mb-2 flex items-end pb-2">
                      <span className="text-zinc-300">Awaiting Signature...</span>
                    </div>
                    <p className="font-bold">Consultant Signature</p>
                    <p className="text-zinc-500">Date: <span className="bg-zinc-100 border border-zinc-200 px-1 rounded">[DATE]</span></p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="print:break-before-page border-t border-zinc-400 pt-12 mt-12">
            <h2 className="text-center font-bold text-[16px] uppercase tracking-wider mb-2">EXHIBIT A</h2>
            <h3 className="text-center font-bold text-[14px] uppercase tracking-wider mb-8">COMMISSION AND SUCCESS STRUCTURE</h3>
            <p className="mb-6 italic">This Exhibit forms part of the Agreement.</p>

            <div className="clause-block">
              <h4 className="font-bold mb-2">1. Initial Commercial Model</h4>
              <p className="mb-4">The Consultant shall work on a commission-only model until the successful closure of three Qualifying Projects.</p>
              <table className="w-full text-left border-collapse mb-8 border border-zinc-200">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    <th className="p-3 border-r border-zinc-200 font-semibold text-zinc-900">Stage</th>
                    <th className="p-3 font-semibold text-zinc-900">Compensation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  <tr><td className="p-3 border-r border-zinc-200">Before first project closure</td><td className="p-3">No base pay; commission-only</td></tr>
                  <tr><td className="p-3 border-r border-zinc-200">After first qualifying project</td><td className="p-3 font-medium">22% of Gross Profit</td></tr>
                  <tr><td className="p-3 border-r border-zinc-200">After second qualifying project</td><td className="p-3 font-medium">22% of Gross Profit</td></tr>
                  <tr><td className="p-3 border-r border-zinc-200">After third qualifying project</td><td className="p-3">Eligible for base pay discussion</td></tr>
                  <tr><td className="p-3 border-r border-zinc-200">After base pay approval</td><td className="p-3">Revised structure to be documented separately</td></tr>
                </tbody>
              </table>
            </div>

            <div className="clause-block">
              <h4 className="font-bold mb-2">2. Commission Percentage</h4>
              <p className="mb-2">The Consultant shall receive 22% of Gross Profit from each Qualifying Project.</p>
              <p className="mb-6">Gross Profit shall mean: Project Cost actually received by Invade Code minus all project-related expenses.</p>
            </div>

            <div className="clause-block">
              <h4 className="font-bold mb-2">3. What Counts as a Successful Project?</h4>
              <p className="mb-2">A project shall be counted toward the three-project success milestone only when:</p>
              <div className="pl-4 mb-6 space-y-1">
                <p>a. the Consultant introduced the opportunity;</p>
                <p>b. the Company accepted the lead in writing;</p>
                <p>c. the client had a genuine requirement for technology, AI, ERP, CRM, automation, cloud, or related services;</p>
                <p>d. Invade Code issued a proposal, SOW, or commercial offer;</p>
                <p>e. the client signed the project;</p>
                <p>f. the first client payment was received by Invade Code;</p>
                <p>g. the project was not cancelled before commencement.</p>
              </div>
            </div>

            <div className="clause-block">
              <h4 className="font-bold mb-2">4. What Does Not Count as Success?</h4>
              <p className="mb-2">The following shall not count toward the success milestone:</p>
              <div className="pl-4 mb-6 space-y-1">
                <p>a. generic networking conversations;</p>
                <p>b. unqualified introductions;</p>
                <p>c. leads without decision-maker access;</p>
                <p>d. meetings with no business requirement;</p>
                <p>e. unpaid pilots unless approved in writing;</p>
                <p>f. verbal promises;</p>
                <p>g. proposals not accepted by the client;</p>
                <p>h. projects already being pursued by Invade Code;</p>
                <p>i. projects where the Consultant had no material role;</p>
                <p>j. projects cancelled before first payment.</p>
              </div>
            </div>

            <div className="clause-block">
              <h4 className="font-bold mb-2">5. Success Milestone</h4>
              <p className="mb-2">The initial success milestone shall be: <b>Three signed and paid client projects introduced by the Consultant.</b></p>
              <div className="pl-4 mb-6 space-y-1">
                <p>• Expected timeline: {TimelineDisplay} days</p>
                <p>• Minimum expected pipeline: [10–15 qualified opportunities]</p>
                <p>• Minimum expected meetings: [6–8 decision-maker meetings per month]</p>
                <p>• Minimum expected proposal-stage opportunities: [3–5 active proposals during the initial phase]</p>
              </div>
            </div>

            <div className="clause-block">
              <h4 className="font-bold mb-2">6. Example of Success</h4>
              <p className="mb-4">The Consultant shall be considered successful if he/she/they achieves the following:</p>
              <table className="w-full text-left border-collapse mb-8 border border-zinc-200">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    <th className="p-3 border-r border-zinc-200 font-semibold text-zinc-900">Metric</th>
                    <th className="p-3 font-semibold text-zinc-900">Expected Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  <tr><td className="p-3 border-r border-zinc-200">Qualified leads generated</td><td className="p-3">10–15</td></tr>
                  <tr><td className="p-3 border-r border-zinc-200">Decision-maker meetings arranged</td><td className="p-3">6–8 per month</td></tr>
                  <tr><td className="p-3 border-r border-zinc-200">Discovery calls completed</td><td className="p-3">5+</td></tr>
                  <tr><td className="p-3 border-r border-zinc-200">Proposal-stage opportunities</td><td className="p-3">3–5</td></tr>
                  <tr><td className="p-3 border-r border-zinc-200 font-bold">Projects closed</td><td className="p-3 font-bold">3</td></tr>
                  <tr><td className="p-3 border-r border-zinc-200">First payment received</td><td className="p-3">Yes</td></tr>
                  <tr><td className="p-3 border-r border-zinc-200">Consultant conduct</td><td className="p-3">Professional, accurate, compliant</td></tr>
                  <tr><td className="p-3 border-r border-zinc-200">Client quality</td><td className="p-3">Real business need, budget, decision-maker access</td></tr>
                  <tr><td className="p-3 border-r border-zinc-200">Internal coordination</td><td className="p-3">Timely notes, clean handover, proper follow-ups</td></tr>
                </tbody>
              </table>
            </div>

            <div className="clause-block">
              <h4 className="font-bold mb-2">7. Ideal Client Profile</h4>
              <p className="mb-2">The Consultant shall focus on clients that need:</p>
              <div className="pl-4 mb-6 space-y-1">
                <p>a. custom ERP systems;</p>
                <p>b. CRM platforms;</p>
                <p>c. AI-led internal tools;</p>
                <p>d. business process automation;</p>
                <p>e. workflow digitization;</p>
                <p>f. legacy system modernization;</p>
                <p>g. cloud-native platforms;</p>
                <p>h. data dashboards and analytics;</p>
                <p>i. integrations with existing enterprise systems;</p>
                <p>j. managed technology implementation.</p>
              </div>
            </div>

            <div className="clause-block">
              <h4 className="font-bold mb-2">8. Invade Code Positioning</h4>
              <p className="mb-2">The Consultant shall position Invade Code as:</p>
              <div className="pl-4 mb-6 space-y-1">
                <p>a. an India-based AI and technology solutions company;</p>
                <p>b. capable of building ERP, CRM, AI tools, and business platforms;</p>
                <p>c. experienced in solving business problems through custom technology;</p>
                <p>d. capable of hosting cloud-native solutions;</p>
                <p>e. capable of implementing solutions on client-owned cloud or infrastructure;</p>
                <p>f. able to support clients from discovery to development, deployment, and support.</p>
              </div>
            </div>

            <div className="clause-block">
              <h4 className="font-bold mb-2">9. Base Pay Eligibility</h4>
              <p className="mb-2">After three Qualifying Projects are closed and paid, the Company may consider a base pay structure.</p>
              <p className="mb-2">The final base pay model may depend on:</p>
              <div className="pl-4 mb-6 space-y-1">
                <p>a. total revenue brought in;</p>
                <p>b. gross profit generated;</p>
                <p>c. quality of clients;</p>
                <p>d. repeatability of pipeline;</p>
                <p>e. sales cycle maturity;</p>
                <p>f. Consultant’s role in closure;</p>
                <p>g. ability to manage U.S.-based client relationships;</p>
                <p>h. cost of ongoing engagement.</p>
              </div>
            </div>

            <div className="clause-block">
              <h4 className="font-bold mb-2">10. Possible Future Base Pay Model</h4>
              <p className="mb-4">The following is only a discussion framework and not a commitment:</p>
              <table className="w-full text-left border-collapse mb-6 border border-zinc-200">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    <th className="p-3 border-r border-zinc-200 font-semibold text-zinc-900">Model</th>
                    <th className="p-3 font-semibold text-zinc-900">Structure</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  <tr><td className="p-3 border-r border-zinc-200 font-medium">Retainer + reduced commission</td><td className="p-3">Monthly retainer plus lower GP commission</td></tr>
                  <tr><td className="p-3 border-r border-zinc-200 font-medium">Draw against commission</td><td className="p-3">Advance paid monthly and adjusted against earned commission</td></tr>
                  <tr><td className="p-3 border-r border-zinc-200 font-medium">Fixed base + target</td><td className="p-3">Base pay tied to monthly/quarterly targets</td></tr>
                  <tr><td className="p-3 border-r border-zinc-200 font-medium">Territory model</td><td className="p-3">Consultant manages specific geography or vertical</td></tr>
                  <tr><td className="p-3 border-r border-zinc-200 font-medium">Strategic partner model</td><td className="p-3">Consultant works on high-ticket enterprise accounts only</td></tr>
                </tbody>
              </table>
              <p className="mb-8 italic">No base pay shall be valid unless issued in a separate written amendment.</p>
            </div>

            <div className="clause-block">
              <h4 className="font-bold mb-2">11. Deal Attribution Rules</h4>
              <p className="mb-2">A project shall be attributed to the Consultant only if:</p>
              <div className="pl-4 mb-6 space-y-1">
                <p>a. the Consultant was the original source of the opportunity;</p>
                <p>b. the lead was registered and accepted;</p>
                <p>c. the Consultant facilitated meaningful access to the decision-maker;</p>
                <p>d. the Consultant supported the deal through the sales process;</p>
                <p>e. the project closed substantially due to the Consultant’s introduction and involvement.</p>
              </div>
            </div>

            <div className="clause-block">
              <h4 className="font-bold mb-2">12. Renewal, Upsell, and Expansion</h4>
              <p className="mb-2">Unless separately agreed:</p>
              <div className="pl-4 mb-6 space-y-1">
                <p>a. commission is payable only on the original signed project scope;</p>
                <p>b. renewals are not automatically commissionable;</p>
                <p>c. AMC, support, hosting, maintenance, or retainer revenue is not automatically commissionable;</p>
                <p>d. future upsells or new scopes from the same client require separate written approval for commission.</p>
              </div>
            </div>

            <div className="clause-block">
              <h4 className="font-bold mb-2">13. Quality Standard</h4>
              <p className="mb-2">Success shall not be measured only by number of introductions.</p>
              <p className="mb-2">The Consultant must bring opportunities that are:</p>
              <div className="pl-4 mb-6 space-y-1">
                <p>a. real;</p>
                <p>b. budget-backed;</p>
                <p>c. decision-maker connected;</p>
                <p>d. relevant to Invade Code’s services;</p>
                <p>e. commercially viable;</p>
                <p>f. ethically sourced;</p>
                <p>g. capable of conversion.</p>
              </div>
            </div>

            <div className="clause-block">
              <h4 className="font-bold mb-2">14. Reporting Format</h4>
              <p className="mb-4">The Consultant shall submit weekly updates in the following format:</p>
              <table className="w-full text-left border-collapse mb-8 border border-zinc-200">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    <th className="p-2 border-r border-zinc-200 font-semibold text-zinc-900">Client</th>
                    <th className="p-2 border-r border-zinc-200 font-semibold text-zinc-900">Contact Person</th>
                    <th className="p-2 border-r border-zinc-200 font-semibold text-zinc-900">Requirement</th>
                    <th className="p-2 border-r border-zinc-200 font-semibold text-zinc-900">Deal Stage</th>
                    <th className="p-2 border-r border-zinc-200 font-semibold text-zinc-900">Expected Value</th>
                    <th className="p-2 border-r border-zinc-200 font-semibold text-zinc-900">Next Step</th>
                    <th className="p-2 font-semibold text-zinc-900">Date of Next Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2 border-r border-zinc-200 h-8"></td>
                    <td className="p-2 border-r border-zinc-200 h-8"></td>
                    <td className="p-2 border-r border-zinc-200 h-8"></td>
                    <td className="p-2 border-r border-zinc-200 h-8"></td>
                    <td className="p-2 border-r border-zinc-200 h-8"></td>
                    <td className="p-2 border-r border-zinc-200 h-8"></td>
                    <td className="p-2 h-8"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="clause-block">
              <h4 className="font-bold mb-2">15. Success Review</h4>
              <p className="mb-2">After the initial success milestone, the Parties shall review:</p>
              <div className="pl-4 mb-4 space-y-1">
                <p>a. revenue closed;</p>
                <p>b. gross profit generated;</p>
                <p>c. average deal size;</p>
                <p>d. client quality;</p>
                <p>e. sales cycle length;</p>
                <p>f. Consultant’s contribution;</p>
                <p>g. future pipeline;</p>
                <p>h. proposed base pay structure.</p>
              </div>
              <p className="mb-6 font-bold">The review shall determine whether the relationship continues as commission-only, moves to retainer plus commission, or is discontinued.</p>
            </div>
          </div>
        </div>

        {/* Comment Panel Overlay */}
        {activeCommentClause && (
          <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl border-l border-zinc-200 z-50 flex flex-col animate-in slide-in-from-right-8 print:hidden">
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <h3 className="font-bold text-sm">Comments: Clause {activeCommentClause}</h3>
              <button onClick={() => setActiveCommentClause(null)} className="text-zinc-400 hover:text-black">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/30">
              {docData.comments?.[activeCommentClause]?.map((c) => (
                <div key={c.id} className={`p-3 rounded-lg text-xs ${c.user === user.email ? 'bg-blue-50 border border-blue-100 ml-4' : 'bg-white border border-zinc-200 shadow-sm mr-4'}`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-zinc-900 truncate">{c.user.split('@')[0]}</span>
                    <span className="text-[9px] text-zinc-400">{new Date(c.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <p className="text-zinc-700 leading-relaxed">{c.text}</p>
                </div>
              )) || <p className="text-xs text-zinc-400 text-center mt-10">No comments on this clause yet.</p>}
            </div>
            
            <div className="p-3 border-t border-zinc-200 bg-white">
               {docData.comments?.[activeCommentClause]?.length > 0 && (
                <button 
                  onClick={generateAICommentReply}
                  disabled={aiLoading === 'comment'}
                  className="w-full mb-2 flex items-center justify-center gap-1 text-[10px] py-1.5 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium transition-colors border border-purple-100 disabled:opacity-50"
                >
                  {aiLoading === 'comment' ? 'Drafting...' : '✨ Suggest AI Reply'}
                </button>
              )}
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input type="text" value={newCommentText} onChange={(e) => setNewCommentText(e.target.value)} placeholder="Type a comment..." className="flex-1 border border-zinc-300 rounded-md px-3 py-2 text-xs focus:ring-1 focus:ring-black outline-none" />
                <button type="submit" className="bg-black text-white px-3 py-2 rounded-md text-xs font-medium hover:bg-zinc-800">Send</button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (activeTab === 'login' || activeTab === 'register') return renderAuth();
  if (activeTab === 'dashboard') return renderDashboard();
  
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-100 font-['Poppins'] print:block print:h-auto print:overflow-visible">
      {renderDocumentForm()}
      {renderDocumentPreview()}
    </div>
  );
}
