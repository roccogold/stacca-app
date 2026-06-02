type Props = {
  text: string;
};

export function CuriositaText({ text }: Props) {
  return <p className="weather-card__detto-text">{text}</p>;
}
