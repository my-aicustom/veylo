export function BrandMark({ href }: { href?: string }) {
  const content = <>
    <span className="brand-symbol" aria-hidden="true"><img src="/app/veylo-mark.png" alt="" width="30" height="30" /></span>
    <span>VEYLO</span>
  </>;

  const veyloMark = href
    ? <a className="brand-mark" href={href} aria-label="Veylo home">{content}</a>
    : <div className="brand-mark" aria-label="Veylo">{content}</div>;

  return (
    <div className="brand-cluster">
      {veyloMark}
      <a
        className="brand-powered"
        href="https://my-aicustom.com"
        aria-label="Powered by my-aicustom"
        target="_blank"
        rel="noreferrer"
      >
        <img src="/app/my-aicustom-logo.webp" alt="" width="22" height="22" />
        <span>Powered by my-aicustom</span>
      </a>
    </div>
  );
}
