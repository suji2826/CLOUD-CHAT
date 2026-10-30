import { colorFor, initials } from "@/lib/format";

export default function Avatar({
  name,
  photoURL,
  size = 40,
}: {
  name?: string;
  photoURL?: string | null;
  size?: number;
}) {
  const style = { width: size, height: size, fontSize: size * 0.38 };
  if (photoURL) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="avatar" src={photoURL} alt={name || "avatar"} style={style} referrerPolicy="no-referrer" />;
  }
  return (
    <div className="avatar" style={{ ...style, background: colorFor(name || "?") }} aria-label={name}>
      {initials(name)}
    </div>
  );
}
