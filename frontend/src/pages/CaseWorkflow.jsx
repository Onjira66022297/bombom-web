import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

const STEPS = ['Search Email', 'Analyze Email', 'Select Specs', 'Check BOM'];

export default function CaseWorkflow() {
  const [step, setStep] = useState(0);
  const [caseData, setCaseData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [emailQuery, setEmailQuery] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [requirementsText, setRequirementsText] = useState('');
  const [eCode, setECode] = useState('');
  const [bomFile, setBomFile] = useState(null);
  const [bomResult, setBomResult] = useState(null);

  const wrap = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const handleSearchEmail = () =>
    wrap(async () => {
      // Outlook search isn't wired to real credentials yet — see backend/src/routes/emails.js.
      // We still create a real case record so the rest of the pipeline is fully functional.
      const { case: created } = await api.createCase({ customerName: customerName || undefined });
      setCaseData(created);
      setStep(1);
    });

  const handleAnalyze = () =>
    wrap(async () => {
      // In production this text comes from AI extraction over the email body (Thai-language NLP).
      // For now, requirements are entered directly and stored the same way the AI output would be.
      const requirements = { notes: requirementsText };
      const { case: updated } = await api.analyzeCase(caseData.id, requirements);
      setCaseData(updated);
      setStep(2);
    });

  const handleSelectSpecs = () =>
    wrap(async () => {
      const { case: updated } = await api.selectSpecs(caseData.id, eCode.trim());
      setCaseData(updated);
      setStep(3);
    });

  const handleBomCheck = () =>
    wrap(async () => {
      if (!bomFile) throw { response: { data: { error: 'Choose a BOM file first' } } };
      const { bomCheck } = await api.runBomCheck(caseData.id, bomFile);
      setBomResult(bomCheck);
    });

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-[#3a8a3a] text-white font-bold flex items-center justify-center">B</div>
          <span className="font-semibold text-gray-900">BOMBOM</span>
        </div>
        <Link to="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">← Back to dashboard</Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                  i < step
                    ? 'bg-[#3a8a3a] text-white'
                    : i === step
                    ? 'bg-[#e8f5e9] text-[#2e7d32] ring-2 ring-[#3a8a3a]'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {i < step ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 ${i < step ? 'bg-[#3a8a3a]' : 'bg-gray-100'}`} />}
            </div>
          ))}
        </div>
        <p className="text-xs font-medium text-[#2e7d32] mb-1">Step {step + 1} of 4</p>
        <h1 className="text-xl font-semibold text-gray-900 mb-6">{STEPS[step]}</h1>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 mb-4">
            {error}
          </div>
        )}

        {step === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Outlook search isn't connected in this environment yet (needs Azure AD credentials — see
              the backend README). You can still start a case manually to exercise the rest of the pipeline.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search Outlook (disabled)</label>
              <input
                disabled
                value={emailQuery}
                onChange={(e) => setEmailQuery(e.target.value)}
                placeholder="Not yet connected"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer name</label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3a8a3a]"
                placeholder="e.g. Siam Manufacturing Co., Ltd."
              />
            </div>
            <button
              disabled={busy}
              onClick={handleSearchEmail}
              className="rounded-lg bg-[#3a8a3a] hover:bg-[#2e7d32] text-white text-sm font-medium px-4 py-2.5 disabled:opacity-60"
            >
              {busy ? 'Creating case…' : 'Start case'}
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              AI extraction of Thai-language requirements isn't wired to a model yet. Enter the requirements
              directly for now — they're stored in the same field the AI output would populate.
            </p>
            <textarea
              value={requirementsText}
              onChange={(e) => setRequirementsText(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3a8a3a]"
              placeholder="Customer requirements..."
            />
            <button
              disabled={busy}
              onClick={handleAnalyze}
              className="rounded-lg bg-[#3a8a3a] hover:bg-[#2e7d32] text-white text-sm font-medium px-4 py-2.5 disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Continue'}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Enter the Dell E-Code for this configuration. It must already be published in the product catalog.
            </p>
            <input
              value={eCode}
              onChange={(e) => setECode(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3a8a3a]"
              placeholder="e.g. xcto_pb14250_apac"
            />
            <button
              disabled={busy}
              onClick={handleSelectSpecs}
              className="rounded-lg bg-[#3a8a3a] hover:bg-[#2e7d32] text-white text-sm font-medium px-4 py-2.5 disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Continue'}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Upload the customer's BOM (.xlsx/.xls/.csv) to validate against {eCode}'s compatible
              configurations.
            </p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setBomFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
            <button
              disabled={busy}
              onClick={handleBomCheck}
              className="rounded-lg bg-[#3a8a3a] hover:bg-[#2e7d32] text-white text-sm font-medium px-4 py-2.5 disabled:opacity-60 block"
            >
              {busy ? 'Checking…' : 'Run BOM check'}
            </button>

            {bomResult && (
              <div className="mt-6 border border-gray-100 rounded-xl p-4">
                <p
                  className={`text-sm font-semibold mb-3 ${
                    bomResult.is_compatible ? 'text-[#2e7d32]' : 'text-red-600'
                  }`}
                >
                  {bomResult.is_compatible ? '✓ BOM is compatible' : '✗ Compatibility issues found'}
                </p>
                <div className="space-y-1.5">
                  {bomResult.result.rows.map((r, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-gray-600">{r.componentType}: {r.value}</span>
                      <span className={r.status === 'pass' ? 'text-[#2e7d32]' : 'text-red-600'}>
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
