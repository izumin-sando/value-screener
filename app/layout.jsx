export const metadata = {
  title: 'バリュー株スクリーナー',
  description: '東証プライム全銘柄対応 - J-Quants API連携',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
