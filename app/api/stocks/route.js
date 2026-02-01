import { getScreeningData, getListedInfo, getDailyQuotes } from '@/lib/jquants';

// キャッシュ設定（5分）
export const revalidate = 300;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'screening';

    if (action === 'screening') {
      // スクリーニング用データ取得
      const data = await getScreeningData();
      return Response.json(data);
    }

    if (action === 'listed') {
      // 上場銘柄一覧のみ
      const data = await getListedInfo();
      return Response.json({ info: data, count: data.length });
    }

    if (action === 'quotes') {
      // 株価データのみ
      const date = searchParams.get('date');
      if (!date) {
        return Response.json({ error: 'date parameter required' }, { status: 400 });
      }
      const data = await getDailyQuotes(date);
      return Response.json({ quotes: data, count: data.length });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('API Error:', error);
    return Response.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
