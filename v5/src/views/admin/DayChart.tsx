import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export default function DayChart({ data }: { data: { day: string; leads: number; joined: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--line)" />
        <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--muted)' }} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--muted)' }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10 }} cursor={{ fill: 'var(--bg-soft)' }} />
        <Bar dataKey="leads" name="Leads" fill="var(--brand-2)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="joined" name="Paid" fill="var(--ok)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
