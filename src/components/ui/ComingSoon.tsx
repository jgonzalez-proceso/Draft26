import { Construction } from "lucide-react";

export default function ComingSoon({
  title,
  stage,
  desc,
}: {
  title: string;
  stage: string;
  desc: string;
}) {
  return (
    <div className="card p-8 text-center">
      <Construction className="mx-auto mb-3 h-9 w-9 text-gold-400" />
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{desc}</p>
      <span className="badge mt-4 bg-surface-2 text-muted">{stage}</span>
    </div>
  );
}
