/**
 * J-Quants API クライアント
 * 東証プライム全銘柄の株価・財務データを取得
 */

const BASE_URL = 'https://api.jquants.com/v1';

// IDトークンをキャッシュ（24時間有効）
let cachedToken = null;
/**
 * J-Quants API クライアント
  * 東証プライム全銘柄の株価・財務データを取得
   */

const BASE_URL = 'https://api.jquants.com/v1';

// IDトークンをキャッシュ（24時間有効）
let cachedIdToken = null;
let idTokenExpiry = 0;

/**
 * IDトークンを取得
  * JQUANTS_API_KEY はリフレッシュトークンとして使用
   */
export async function getIdToken() {
    const now = Date.now();
  
    // キャッシュが有効ならそれを返す
    if (cachedIdToken && now < idTokenExpiry) {
          return cachedIdToken;
    }
  
    const refreshToken = process.env.JQUANTS_API_KEY;
    if (!refreshToken) {
          throw new Error('JQUANTS_API_KEY (リフレッシュトークン) is not set');
    }
  
    // リフレッシュトークンでIDトークンを取得
    const res = await fetch(`${BASE_URL}/token/auth_refresh?refreshtoken=${refreshToken}`, {
          method: 'POST',
    });
  
    if (!res.ok) {
          const error = await res.text();
          throw new Error(`Failed to get ID token: ${error}. リフレッシュトークンが無効か期限切れの可能性があります。J-Quantsダッシュボード（https://application.jpx-jquants.com/）から新しいリフレッシュトークンを取得してください。`);
    }
  
    const data = await res.json();
    cachedIdToken = data.idToken;
    // 23時間キャッシュ（24時間有効だが余裕を持たせる）
    idTokenExpiry = now + 23 * 60 * 60 * 1000;
  
    return cachedIdToken;
}

/**
 * 上場銘柄一覧を取得
  * @param {string} marketCode - 市場コード（東証プライム: 0111）
   */
export async function getListedInfo(marketCode = '0111') {
    const token = await getIdToken();
  
    const res = await fetch(`${BASE_URL}/listed/info`, {
          headers: { Authorization: `Bearer ${token}` },
    });
  
    if (!res.ok) {
          throw new Error(`Failed to get listed info: ${res.status}`);
    }
  
    const data = await res.json();
  
    // 東証プライムのみフィルタ
    return data.info.filter(stock => stock.MarketCode === marketCode);
}

/**
 * 株価四本値を取得（日付指定で全銘柄）
  * @param {string} date - 日付（YYYY-MM-DD形式）
   */
export async function getDailyQuotes(date) {
    const token = await getIdToken();
  
    const res = await fetch(`${BASE_URL}/prices/daily_quotes?date=${date}`, {
          headers: { Authorization: `Bearer ${token}` },
    });
  
    if (!res.ok) {
          throw new Error(`Failed to get daily quotes: ${res.status}`);
    }
  
    const data = await res.json();
    return data.daily_quotes || [];
}

/**
 * 財務データを取得
  * @param {string} code - 銘柄コード（オプション）
   */
export async function getStatements(code = null) {
    const token = await getIdToken();
  
    let url = `${BASE_URL}/fins/statements`;
    if (code) {
          url += `?code=${code}`;
    }
  
    const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
    });
  
    if (!res.ok) {
          throw new Error(`Failed to get statements: ${res.status}`);
    }
  
    const data = await res.json();
    return data.statements || [];
}

/**
 * 東証プライム全銘柄のスクリーニングデータを取得
  * 株価 + 財務データを結合
   */
export async function getScreeningData() {
    // 直近の営業日を計算（簡易版：土日を除く）
    const getLatestBusinessDate = () => {
          const date = new Date();
          const day = date.getDay();
      
          // 土曜なら金曜に、日曜なら金曜に
          if (day === 0) date.setDate(date.getDate() - 2);
          else if (day === 6) date.setDate(date.getDate() - 1);
      
          // 無料プランは12週間遅れなので、12週間前の日付を使用
          date.setDate(date.getDate() - 84); // 無料プラン用（ライトプラン以上なら削除）
      
          return date.toISOString().split('T')[0];
    };
  
    const date = getLatestBusinessDate();
  
    // 並列で取得
    const [listedInfo, dailyQuotes] = await Promise.all([
          getListedInfo(),
          getDailyQuotes(date),
        ]);
  
    // 銘柄コードをキーにしたマップを作成
    const quotesMap = new Map();
    dailyQuotes.forEach(q => {
          quotesMap.set(q.Code, q);
    });
  
    // データを結合
    const stocks = listedInfo
          .map(info => {
                  const quote = quotesMap.get(info.Code);
                  if (!quote) return null;
            
                  const price = quote.Close || quote.AdjustmentClose;
                  const eps = quote.EarningsPerShare || 0;
                  const bps = quote.BookValuePerShare || 0;
            
                  // EPS/BPSが0の場合は仮の値を設定（財務データAPIから別途取得推奨）
                  return {
                            code: info.Code,
                            name: info.CompanyName,
                            nameEn: info.CompanyNameEnglish,
                            sector: info.Sector33CodeName || info.Sector17CodeName || '未分類',
                            market: info.MarketCodeName,
                            price: price,
                            volume: quote.Volume,
                            turnover: quote.TurnoverValue,
                            // 財務データ（daily_quotesに含まれる場合）
                            eps: eps > 0 ? eps : price * 0.1, // 仮：PER10倍相当
                            bps: bps > 0 ? bps : price * 1.0, // 仮：PBR1倍相当
                            per: eps > 0 ? +(price / eps).toFixed(2) : null,
                            pbr: bps > 0 ? +(price / bps).toFixed(2) : null,
                            date: quote.Date,
                  };
          })
          .filter(s => s !== null && s.price > 0);
  
    return {
          stocks,
          date,
          count: stocks.length,
    };
}let tokenExpiry = 0;

/**
 * IDトークンを取得（APIキーから）
 */
export async function getIdToken() {
  const now = Date.now();

  // キャッシュが有効ならそれを返す
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  const apiKey = process.env.JQUANTS_API_KEY;
  if (!apiKey) {
    throw new Error('JQUANTS_API_KEY is not set');
  }

  // APIキーでリフレッシュトークンを取得
  const refreshRes = await fetch(`${BASE_URL}/token/auth_refresh?apikey=${apiKey}`, {
    method: 'POST',
  });

  if (!refreshRes.ok) {
    const error = await refreshRes.text();
    throw new Error(`Failed to get token: ${error}`);
  }

  const { idToken } = await refreshRes.json();

  // 23時間キャッシュ（少し余裕を持たせる）
  cachedToken = idToken;
  tokenExpiry = now + 23 * 60 * 60 * 1000;

  return idToken;
}

/**
 * 上場銘柄一覧を取得
 * @param {string} marketCode - 市場コード（東証プライム: 0111）
 */
export async function getListedInfo(marketCode = '0111') {
  const token = await getIdToken();

  const res = await fetch(`${BASE_URL}/listed/info`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to get listed info: ${res.status}`);
  }

  const data = await res.json();

  // 東証プライムのみフィルタ
  return data.info.filter(stock => stock.MarketCode === marketCode);
}

/**
 * 株価四本値を取得（日付指定で全銘柄）
 * @param {string} date - 日付（YYYY-MM-DD形式）
 */
export async function getDailyQuotes(date) {
  const token = await getIdToken();

  const res = await fetch(`${BASE_URL}/prices/daily_quotes?date=${date}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to get daily quotes: ${res.status}`);
  }

  const data = await res.json();
  return data.daily_quotes || [];
}

/**
 * 財務データを取得
 * @param {string} code - 銘柄コード（オプション）
 */
export async function getStatements(code = null) {
  const token = await getIdToken();

  let url = `${BASE_URL}/fins/statements`;
  if (code) {
    url += `?code=${code}`;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to get statements: ${res.status}`);
  }

  const data = await res.json();
  return data.statements || [];
}

/**
 * 東証プライム全銘柄のスクリーニングデータを取得
 * 株価 + 財務データを結合
 */
export async function getScreeningData() {
  // 直近の営業日を計算（簡易版：土日を除く）
  const getLatestBusinessDate = () => {
    const date = new Date();
    const day = date.getDay();

    // 土曜なら金曜に、日曜なら金曜に
    if (day === 0) date.setDate(date.getDate() - 2);
    else if (day === 6) date.setDate(date.getDate() - 1);

    // 無料プランは12週間遅れなので、12週間前の日付を使用
    // ライトプラン以上なら当日データが取れる
    // date.setDate(date.getDate() - 84); // 無料プラン用

    return date.toISOString().split('T')[0];
  };

  const date = getLatestBusinessDate();

  // 並列で取得
  const [listedInfo, dailyQuotes] = await Promise.all([
    getListedInfo(),
    getDailyQuotes(date),
  ]);

  // 銘柄コードをキーにしたマップを作成
  const quotesMap = new Map();
  dailyQuotes.forEach(q => {
    quotesMap.set(q.Code, q);
  });

  // データを結合
  const stocks = listedInfo
    .map(info => {
      const quote = quotesMap.get(info.Code);
      if (!quote) return null;

      const price = quote.Close || quote.AdjustmentClose;
      const eps = quote.EarningsPerShare || 0;
      const bps = quote.BookValuePerShare || 0;

      // EPS/BPSが0の場合は仮の値を設定（財務データAPIから別途取得推奨）
      return {
        code: info.Code,
        name: info.CompanyName,
        nameEn: info.CompanyNameEnglish,
        sector: info.Sector33CodeName || info.Sector17CodeName || '未分類',
        market: info.MarketCodeName,
        price: price,
        volume: quote.Volume,
        turnover: quote.TurnoverValue,
        // 財務データ（daily_quotesに含まれる場合）
        eps: eps > 0 ? eps : price * 0.1, // 仮：PER10倍相当
        bps: bps > 0 ? bps : price * 1.0, // 仮：PBR1倍相当
        per: eps > 0 ? +(price / eps).toFixed(2) : null,
        pbr: bps > 0 ? +(price / bps).toFixed(2) : null,
        date: quote.Date,
      };
    })
    .filter(s => s !== null && s.price > 0);

  return {
    stocks,
    date,
    count: stocks.length,
  };
}
