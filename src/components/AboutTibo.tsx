import { assetUrl } from '../lib/base';

export interface AboutTiboProps {
  labels: {
    title: string;
    name: string;
    role: string;
    followers: string;
    desc: string;
    viewProfile: string;
  };
}

export function AboutTibo({ labels }: AboutTiboProps) {
  return (
    <section className="tibo">
      <img
        className="tibo__avatar"
        src={assetUrl('img/tibo-avatar.jpg')}
        alt=""
        width={88}
        height={88}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      <div className="tibo__body">
        <h3 className="tibo__name">{labels.name}</h3>
        <p className="tibo__role">{labels.role}</p>
        <p className="tibo__desc">{labels.desc}</p>
        <a
          className="btn"
          href="https://x.com/thsottiaux"
          target="_blank"
          rel="noopener noreferrer"
        >
          {labels.viewProfile} →
        </a>
      </div>
      <p className="tibo__followers">{labels.followers}</p>
    </section>
  );
}
