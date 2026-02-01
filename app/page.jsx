'use client';

import { useState, useEffect } from 'react';

// AI分析プロンプト生成
const generateAnalysisPrompt = (code) => `あなたはバリュー投資専門のアナリストです。
証券コード「${code}」の銘柄について、グレアム・ドッド流のバリュー投資フレームワークでリスクと割安度を分析し、100点満点でスコアを算出してください。

## 基本方針
- 「素晴らしい企業をそこそこの価格で買う」より「そこそこの企業を素晴らしい価格で買う」を重視
- 安全域（Margin of Safety）の確保を最優先
- 株価が本質的価値を下回っているかを厳格に評価

## 分析項目
1. バリュエーション評価（45点）：PER/PBR/PSR/EV/EBITDA、本質的価値との乖離、株主還元
2. 財務健全性（30点）：自己資本比率、ネットD/E、流動比率、キャッシュフロー
3. 収益の質・安定性（15点）：営業利益率、ROE/ROIC、事業の安定性
4. 外部環境リスク（10点）：マクロ環境、カタリストの有無

※分析には最新の市場データをウェブ検索で取得してください。
※このスコアは投資判断の参考情報であり、投資助言ではありません。`;

export default function ValueScreener() {
  const [activeTab, setActiveTab] = useState('screen');
  const [maxPER, setMaxPER] = useState(15);
  const [maxPBR, setMaxPBR] = useState(1.2);
  const [stocks, setStocks] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState('all');
  const [sortBy, setSortBy] = useState('per');
  const [dataDate, setDataDate] = useState('');

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/stocks?action=screening');
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to fetch');
        }

        const data = await res.json();
        setStocks(data.stocks.filter(s => s.per && s.per > 0));
        setDataDate(data.date);
      } catch (e) {
        console.error('Fetch error:', e);
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    // ウォッチリストをlocalStorageから読み込み
    const saved = localStorage.getItem('watchlist');
    if (saved) {
      setWatchlist(JSON.parse(saved));
    }
  }, []);

  // セクター一覧
  const sectors = ['all', ...new Set(stocks.map(s => s.sector))].sort();

  // トースト表示
  const showToast = (message, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 2500);
  };

  // プロンプトコピー
  const copyAnalysisPrompt = async (code, name) => {
    const prompt = generateAnalysisPrompt(code);
    try {
      await navigator.clipboard.writeText(prompt);
      showToast(`${name}の分析プロンプトをコピーしました`);
    } catch (e) {
      showToast('コピーに失敗しました', true);
    }
  };

  // フィルタ＆ソート
  const filteredStocks = stocks
    .filter(s => s.per <= maxPER && s.pbr <= maxPBR)
    .filter(s => selectedSector === 'all' || s.sector === selectedSector)
    .filter(s =>
      searchQuery === '' ||
      s.name.includes(searchQuery) ||
      s.code.includes(searchQuery)
    )
    .sort((a, b) => {
      if (sortBy === 'per') return a.per - b.per;
      if (sortBy === 'pbr') return a.pbr - b.pbr;
      if (sortBy === 'price') return a.price - b.price;
      return 0;
    });

  // ウォッチリスト追加
  const addToWatchlist = (stock) => {
    if (watchlist.find(w => w.code === stock.code)) {
      showToast(`${stock.name}は既にウォッチリストにあります`);
      return;
    }
    const entry = {
      ...stock,
      savedAt: new Date().toISOString(),
      savedPrice: stock.price,
    };
    const updated = [...watchlist, entry];
    setWatchlist(updated);
    localStorage.setItem('watchlist', JSON.stringify(updated));
    showToast(`${stock.name}をウォッチリストに追加しました`);
  };

  // ウォッチリスト削除
  const removeFromWatchlist = (code) => {
    const updated = watchlist.filter(w => w.code !== code);
    setWatchlist(updated);
    localStorage.setItem('watchlist', JSON.stringify(updated));
  };

  // パフォーマンス計算
  const calcPerformance = (savedPrice, currentPrice) => {
    const diff = ((currentPrice - savedPrice) / savedPrice * 100).toFixed(1);
    return { diff: +diff, color: diff >= 0 ? '#10b981' : '#ef4444' };
  };

  // 日付フォーマット
  const formatDate = (iso) => {
    const d = new Date(iso);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  };

  // ローディング表示
  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner} />
        <p style={styles.loadingText}>J-Quants APIからデータ取得中...</p>
      </div>
    );
  }

  // エラー表示
  if (error) {
    return (
      <div style={styles.errorContainer}>
        <div style={styles.errorIcon}>⚠️</div>
        <h2 style={styles.errorTitle}>データ取得エラー</h2>
        <p style={styles.errorText}>{error}</p>
        <button style={styles.retryButton} onClick={() => window.location.reload()}>
          再試行
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Toast */}
      {toast && (
        <div style={{...styles.toast, background: toast.isError ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)'}}>
          <span style={styles.toastIcon}>{toast.isError ? '✕' : '✓'}</span>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.title}>バリュー株スクリーナー</h1>
        <p style={styles.subtitle}>
          東証プライム {stocks.length}銘柄 | データ: {dataDate}
        </p>
      </header>

      {/* Main */}
      <main style={styles.main}>
        {activeTab === 'screen' && (
          <div>
            {/* 検索 */}
            <div style={styles.searchBar}>
              <input
                type="text"
                placeholder="銘柄名・コードで検索"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={styles.searchInput}
              />
            </div>

            {/* フィルター */}
            <div style={styles.filterCard}>
              <div style={styles.filterRow}>
                <label style={styles.filterLabel}>
                  PER上限
                  <span style={styles.filterValue}>{maxPER}倍</span>
                </label>
                <input
                  type="range"
                  min="5"
                  max="30"
                  value={maxPER}
                  onChange={(e) => setMaxPER(+e.target.value)}
                  style={styles.slider}
                />
              </div>
              <div style={styles.filterRow}>
                <label style={styles.filterLabel}>
                  PBR上限
                  <span style={styles.filterValue}>{maxPBR}倍</span>
                </label>
                <input
                  type="range"
                  min="0.3"
                  max="3"
                  step="0.1"
                  value={maxPBR}
                  onChange={(e) => setMaxPBR(+e.target.value)}
                  style={styles.slider}
                />
              </div>

              <div style={styles.sectorFilter}>
                <select
                  value={selectedSector}
                  onChange={(e) => setSelectedSector(e.target.value)}
                  style={styles.sectorSelect}
                >
                  <option value="all">全セクター</option>
                  {sectors.filter(s => s !== 'all').map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={styles.sortSelect}
                >
                  <option value="per">PER順</option>
                  <option value="pbr">PBR順</option>
                  <option value="price">株価順</option>
                </select>
              </div>

              <div style={styles.resultCount}>
                {filteredStocks.length}銘柄ヒット
              </div>
            </div>

            {/* 銘柄リスト */}
            <div style={styles.stockList}>
              {filteredStocks.slice(0, 100).map((stock) => (
                <div
                  key={stock.code}
                  style={styles.stockCard}
                  onClick={() => setSelectedStock(stock)}
                >
                  <div style={styles.stockMain}>
                    <div style={styles.stockCode}>{stock.code}</div>
                    <div style={styles.stockName}>{stock.name}</div>
                    <div style={styles.stockSector}>{stock.sector}</div>
                  </div>
                  <div style={styles.stockMetrics}>
                    <div style={styles.stockPrice}>¥{stock.price?.toLocaleString()}</div>
                    <div style={styles.metricsRow}>
                      <span style={styles.metricBadge}>PER {stock.per}</span>
                      <span style={{...styles.metricBadge, ...styles.pbrBadge}}>PBR {stock.pbr}</span>
                    </div>
                  </div>
                  <div style={styles.buttonGroup}>
                    <button
                      style={styles.aiButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        copyAnalysisPrompt(stock.code, stock.name);
                      }}
                    >
                      🤖
                    </button>
                    <button
                      style={styles.addButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        addToWatchlist(stock);
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
              {filteredStocks.length > 100 && (
                <div style={styles.moreIndicator}>
                  他 {filteredStocks.length - 100} 銘柄
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'watchlist' && (
          <div>
            {watchlist.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>📋</div>
                <p style={styles.emptyText}>ウォッチリストは空です</p>
                <p style={styles.emptySubtext}>スクリーニングから銘柄を追加しましょう</p>
              </div>
            ) : (
              <div style={styles.stockList}>
                {watchlist.map((stock) => {
                  const currentStock = stocks.find(s => s.code === stock.code);
                  const currentPrice = currentStock?.price || stock.price;
                  const perf = calcPerformance(stock.savedPrice, currentPrice);
                  return (
                    <div key={stock.code} style={styles.watchCard}>
                      <div style={styles.watchMain}>
                        <div style={styles.stockCode}>{stock.code}</div>
                        <div style={styles.stockName}>{stock.name}</div>
                        <div style={styles.savedDate}>
                          {formatDate(stock.savedAt)} @¥{stock.savedPrice?.toLocaleString()}
                        </div>
                      </div>
                      <div style={styles.watchMetrics}>
                        <div style={styles.currentPrice}>¥{currentPrice?.toLocaleString()}</div>
                        <div style={{...styles.performance, color: perf.color}}>
                          {perf.diff >= 0 ? '+' : ''}{perf.diff}%
                        </div>
                      </div>
                      <div style={styles.buttonGroup}>
                        <button
                          style={styles.aiButton}
                          onClick={() => copyAnalysisPrompt(stock.code, stock.name)}
                        >
                          🤖
                        </button>
                        <button
                          style={styles.removeButton}
                          onClick={() => removeFromWatchlist(stock.code)}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav style={styles.bottomNav}>
        <button
          style={{...styles.navButton, ...(activeTab === 'screen' ? styles.navButtonActive : {})}}
          onClick={() => setActiveTab('screen')}
        >
          <span style={styles.navIcon}>🔍</span>
          <span style={styles.navLabel}>スクリーニング</span>
        </button>
        <button
          style={{...styles.navButton, ...(activeTab === 'watchlist' ? styles.navButtonActive : {})}}
          onClick={() => setActiveTab('watchlist')}
        >
          <span style={styles.navIcon}>⭐</span>
          <span style={styles.navLabel}>ウォッチリスト</span>
          {watchlist.length > 0 && <span style={styles.badge}>{watchlist.length}</span>}
        </button>
      </nav>

      {/* Modal */}
      {selectedStock && (
        <div style={styles.modalOverlay} onClick={() => setSelectedStock(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button style={styles.modalClose} onClick={() => setSelectedStock(null)}>×</button>
            <div style={styles.modalHeader}>
              <span style={styles.modalCode}>{selectedStock.code}</span>
              <h2 style={styles.modalName}>{selectedStock.name}</h2>
              <span style={styles.modalSector}>{selectedStock.sector}</span>
            </div>
            <div style={styles.modalPrice}>¥{selectedStock.price?.toLocaleString()}</div>
            <div style={styles.modalMetrics}>
              <div style={styles.modalMetric}>
                <div style={styles.modalMetricLabel}>PER</div>
                <div style={styles.modalMetricValue}>{selectedStock.per}倍</div>
              </div>
              <div style={styles.modalMetric}>
                <div style={styles.modalMetricLabel}>PBR</div>
                <div style={styles.modalMetricValue}>{selectedStock.pbr}倍</div>
              </div>
              <div style={styles.modalMetric}>
                <div style={styles.modalMetricLabel}>出来高</div>
                <div style={styles.modalMetricValue}>{(selectedStock.volume / 1000).toFixed(0)}千株</div>
              </div>
              <div style={styles.modalMetric}>
                <div style={styles.modalMetricLabel}>売買代金</div>
                <div style={styles.modalMetricValue}>{(selectedStock.turnover / 100000000).toFixed(1)}億円</div>
              </div>
            </div>
            <div style={styles.modalActions}>
              <button
                style={styles.modalAiButton}
                onClick={() => copyAnalysisPrompt(selectedStock.code, selectedStock.name)}
              >
                <span>🤖</span> AI分析プロンプトをコピー
              </button>
              <button
                style={styles.modalAddButton}
                onClick={() => {
                  addToWatchlist(selectedStock);
                  setSelectedStock(null);
                }}
              >
                <span>⭐</span> ウォッチリストに追加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0a0f1a 0%, #111827 100%)',
    color: '#f3f4f6',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif',
    paddingBottom: '80px',
  },
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a0f1a',
    gap: '16px',
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #1f2937',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: '14px',
  },
  errorContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a0f1a',
    padding: '20px',
    textAlign: 'center',
  },
  errorIcon: { fontSize: '48px', marginBottom: '16px' },
  errorTitle: { fontSize: '20px', fontWeight: '700', marginBottom: '8px' },
  errorText: { color: '#9ca3af', marginBottom: '24px' },
  retryButton: {
    padding: '12px 24px',
    borderRadius: '12px',
    background: '#3b82f6',
    border: 'none',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  toast: {
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    color: '#fff',
    padding: '12px 20px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '500',
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
  },
  toastIcon: { fontSize: '16px' },
  header: {
    padding: '20px 20px 16px',
    textAlign: 'center',
    background: 'linear-gradient(180deg, rgba(59,130,246,0.15) 0%, transparent 100%)',
  },
  title: { fontSize: '24px', fontWeight: '700', margin: '0 0 4px' },
  subtitle: { fontSize: '13px', color: '#9ca3af', margin: 0 },
  main: { padding: '0 16px' },
  searchBar: { marginBottom: '12px' },
  searchInput: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(31, 41, 55, 0.6)',
    color: '#f3f4f6',
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  filterCard: {
    background: 'rgba(31, 41, 55, 0.6)',
    borderRadius: '16px',
    padding: '16px',
    marginBottom: '16px',
  },
  filterRow: { marginBottom: '12px' },
  filterLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    color: '#d1d5db',
    marginBottom: '6px',
  },
  filterValue: { color: '#3b82f6', fontWeight: '600' },
  slider: {
    width: '100%',
    height: '6px',
    borderRadius: '3px',
    background: '#374151',
    appearance: 'none',
    outline: 'none',
    cursor: 'pointer',
  },
  sectorFilter: { display: 'flex', gap: '8px', marginBottom: '8px' },
  sectorSelect: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: '10px',
    background: '#1f2937',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#f3f4f6',
    fontSize: '13px',
    outline: 'none',
  },
  sortSelect: {
    width: '100px',
    padding: '10px 12px',
    borderRadius: '10px',
    background: '#1f2937',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#f3f4f6',
    fontSize: '13px',
    outline: 'none',
  },
  resultCount: { textAlign: 'center', fontSize: '13px', color: '#10b981', fontWeight: '600' },
  stockList: { display: 'flex', flexDirection: 'column', gap: '10px' },
  stockCard: {
    background: 'rgba(31, 41, 55, 0.4)',
    borderRadius: '14px',
    padding: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
  },
  stockMain: { flex: 1, minWidth: 0 },
  stockCode: { fontSize: '11px', color: '#6b7280', fontWeight: '500' },
  stockName: {
    fontSize: '14px',
    fontWeight: '600',
    marginTop: '2px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  stockSector: { fontSize: '10px', color: '#9ca3af', marginTop: '2px' },
  stockMetrics: { textAlign: 'right', flexShrink: 0 },
  stockPrice: { fontSize: '15px', fontWeight: '700' },
  metricsRow: { display: 'flex', gap: '4px', marginTop: '4px', justifyContent: 'flex-end' },
  metricBadge: {
    fontSize: '10px',
    fontWeight: '600',
    padding: '2px 6px',
    borderRadius: '4px',
    background: 'rgba(59, 130, 246, 0.2)',
    color: '#60a5fa',
  },
  pbrBadge: { background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' },
  buttonGroup: { display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 },
  aiButton: {
    width: '34px',
    height: '34px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    border: 'none',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: '34px',
    height: '34px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    border: 'none',
    color: '#fff',
    fontSize: '18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButton: {
    width: '34px',
    height: '34px',
    borderRadius: '8px',
    background: 'rgba(239, 68, 68, 0.15)',
    border: 'none',
    color: '#ef4444',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreIndicator: { textAlign: 'center', padding: '16px', color: '#6b7280', fontSize: '13px' },
  watchCard: {
    background: 'rgba(31, 41, 55, 0.4)',
    borderRadius: '14px',
    padding: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  watchMain: { flex: 1, minWidth: 0 },
  savedDate: { fontSize: '10px', color: '#6b7280', marginTop: '4px' },
  watchMetrics: { textAlign: 'right', flexShrink: 0 },
  currentPrice: { fontSize: '14px', fontWeight: '600' },
  performance: { fontSize: '16px', fontWeight: '700', marginTop: '2px' },
  emptyState: { textAlign: 'center', padding: '60px 20px' },
  emptyIcon: { fontSize: '48px', marginBottom: '16px' },
  emptyText: { fontSize: '16px', fontWeight: '600', color: '#d1d5db', margin: '0 0 8px' },
  emptySubtext: { fontSize: '13px', color: '#6b7280', margin: 0 },
  bottomNav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: '70px',
    background: 'rgba(17, 24, 39, 0.95)',
    backdropFilter: 'blur(20px)',
    display: 'flex',
    borderTop: '1px solid rgba(255,255,255,0.05)',
  },
  navButton: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    background: 'none',
    border: 'none',
    color: '#6b7280',
    cursor: 'pointer',
    position: 'relative',
  },
  navButtonActive: { color: '#3b82f6' },
  navIcon: { fontSize: '20px' },
  navLabel: { fontSize: '10px', fontWeight: '500' },
  badge: {
    position: 'absolute',
    top: '8px',
    right: '30%',
    background: '#ef4444',
    color: '#fff',
    fontSize: '10px',
    fontWeight: '700',
    width: '18px',
    height: '18px',
    borderRadius: '9px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: 'linear-gradient(180deg, #1f2937 0%, #111827 100%)',
    borderRadius: '24px 24px 0 0',
    padding: '24px 20px 40px',
    width: '100%',
    maxWidth: '500px',
    position: 'relative',
  },
  modalClose: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    width: '32px',
    height: '32px',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.1)',
    border: 'none',
    color: '#9ca3af',
    fontSize: '20px',
    cursor: 'pointer',
  },
  modalHeader: { marginBottom: '12px' },
  modalCode: { fontSize: '12px', color: '#6b7280', fontWeight: '500' },
  modalName: { fontSize: '20px', fontWeight: '700', margin: '4px 0' },
  modalSector: { fontSize: '12px', color: '#9ca3af' },
  modalPrice: { fontSize: '28px', fontWeight: '700', marginBottom: '20px' },
  modalMetrics: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' },
  modalMetric: { background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '12px' },
  modalMetricLabel: { fontSize: '10px', color: '#6b7280', marginBottom: '4px' },
  modalMetricValue: { fontSize: '16px', fontWeight: '600' },
  modalActions: { display: 'flex', flexDirection: 'column', gap: '10px' },
  modalAiButton: {
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    border: 'none',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  modalAddButton: {
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    border: 'none',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
};
