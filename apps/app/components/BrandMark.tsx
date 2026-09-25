export function BrandMark({ href }: { href?: string }) {
  const content = <>
    <span className="brand-symbol" aria-hidden="true"><img src="/app/veylo-mark.png" alt="" width="30" height="30" /></span>
    <span>VEYLO</span>
  </>;

  return href
    ? <a className="brand-mark" href={href} aria-label="Veylo home">{content}</a>
    : <div className="brand-mark" aria-label="Veylo">{content}</div>;
}
