import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="page">
      <div className="blank">
        <strong>That page does not exist</strong>
        <Link href="/" style={{ color: 'var(--amber)' }}>Back to the assistant</Link>
      </div>
    </div>
  );
}
