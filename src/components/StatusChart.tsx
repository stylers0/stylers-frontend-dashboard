import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Card } from "@/components/ui/card";

interface StatusChartProps {
  data: {
    name: string;
    running: number;
    downtime: number;
    off: number;
  }[];
  type?: "bar" | "pie";
  title: string;
}

const COLORS = {
  running: "hsl(var(--running))",
  downtime: "hsl(var(--downtime))",
  off: "hsl(var(--off))",
};

export function StatusChart({ data, type = "bar", title }: StatusChartProps) {
  if (type === "pie") {
    const pieData = [
      { name: "Running", value: data.reduce((acc, d) => acc + d.running, 0), color: COLORS.running },
      { name: "Downtime", value: data.reduce((acc, d) => acc + d.downtime, 0), color: COLORS.downtime },
      { name: "Off", value: data.reduce((acc, d) => acc + d.off, 0), color: COLORS.off },
    ];

    return (
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4">{title}</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-bold mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" stroke="hsl(var(--foreground))" />
          <YAxis stroke="hsl(var(--foreground))" />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
          />
          <Legend />
          <Bar dataKey="running" fill={COLORS.running} name="Running" radius={[8, 8, 0, 0]} />
          <Bar dataKey="downtime" fill={COLORS.downtime} name="Downtime" radius={[8, 8, 0, 0]} />
          <Bar dataKey="off" fill={COLORS.off} name="Off" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
