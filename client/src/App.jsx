import { useState, useEffect, useMemo } from "react";

export default function App() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:5000/api/logs")
      .then((res) => res.json())
      .then((data) => {
        setLogs(data);
        setLoading(false);
      })
      .catch((err) => console.error("Error fetching logs:", err));
  }, []);

  const metrics = useMemo(() => {
    const total = logs.length;
    const executed = logs.filter(l => l.status === "EXECUTED");
    const blocked = logs.filter(l => l.status === "BLOCKED");
    
    const netRecovered = executed.reduce((sum, l) => sum + (l.policyResult?.expectedNet || 0), 0);
    const avgDiscount = executed.length > 0 
      ? (executed.reduce((sum, l) => sum + (l.policyResult?.boundedDiscount || 0), 0) / executed.length).toFixed(1)
      : 0;

    return { total, attempts: executed.length, blocked: blocked.length, netRecovered, avgDiscount };
  }, [logs]);

  const renderPipeline = (status) => {
    if (status === "BLOCKED") return "INGESTED → DIAGNOSED → 🛑 BLOCKED";
    if (status === "EXECUTED") return "INGESTED → DIAGNOSED → ✅ APPROVED → LINK CREATED";
    return "PROCESSING...";
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-blue-400">RecoverAI Command Center</h1>
        
        {/* Metrics Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-wider">Total Failures</p>
            <p className="text-2xl font-bold">{metrics.total}</p>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-wider">Recovery Attempts</p>
            <p className="text-2xl font-bold">{metrics.attempts}</p>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-wider">Policy Blocked</p>
            <p className="text-2xl font-bold text-red-400">{metrics.blocked}</p>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-wider">Avg Discount</p>
            <p className="text-2xl font-bold text-yellow-400">{metrics.avgDiscount}%</p>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-wider">Net Recovered</p>
            <p className="text-2xl font-bold text-emerald-400">₹{metrics.netRecovered}</p>
          </div>
        </div>

        {/* State Tracking Table */}
        {loading ? (
          <p className="text-slate-400 animate-pulse">Loading audit logs...</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-800 shadow-xl">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-700 text-slate-300 uppercase tracking-wider">
                  <th className="p-4">Execution Pipeline</th>
                  <th className="p-4">Strategy</th>
                  <th className="p-4">Net (INR)</th>
                  <th className="p-4">Razorpay Link</th>
                  <th className="p-4">TX Hash</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                  <tr><td colSpan="5" className="p-4 text-center text-slate-500">No recovery operations logged.</td></tr>
                )}
                {logs.map((log, index) => (
                  <tr key={index} className="border-b border-slate-700 hover:bg-slate-700 transition-colors">
                    <td className="p-4 font-mono text-xs text-slate-300">{renderPipeline(log.status)}</td>
                    <td className="p-4 font-semibold text-slate-200">{log.policyResult?.finalAction || "N/A"}</td>
                    <td className="p-4 font-mono text-emerald-400">{log.policyResult?.expectedNet || 0}</td>
                    <td className="p-4">
                      {log.recoveryUrl ? (
                        <a href={log.recoveryUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">Checkout</a>
                      ) : "N/A"}
                    </td>
                    <td className="p-4 font-mono text-xs text-slate-400">
                      {log.blockchainTx !== "PENDING" ? `${log.blockchainTx.substring(0, 12)}...` : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}