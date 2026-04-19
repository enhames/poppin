import {
    ScatterChart, 
    Scatter,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ResponsiveContainer,
    Legend,
    ReferenceLine
} from "recharts";

type Item = {
    item_name: string,
    transfer_cost: number,
    avoided_penalty: number,
    transfer_value: number,
    recommendation: string
}

export default function ScatterPlot({data}: {data: Item[]}){
    const cleanData = data.filter(
      (d) => Number.isFinite(Number(d.transfer_cost)) && Number.isFinite(Number(d.transfer_value))
    );
    const transfer = cleanData.filter(d => d.recommendation === "TRANSFER");
    const wait = cleanData.filter(d => d.recommendation === "WAIT");

    if (cleanData.length === 0) {
      return (
        <div className="h-[400px] flex items-center justify-center text-sm text-gray-500">
          No plottable transfer points yet.
        </div>
      );
    }

    return (
    <ResponsiveContainer width="100%" height={400}>
      <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
        <CartesianGrid />
        <XAxis
          type="number"
          dataKey="transfer_cost"
          name="Transfer Cost"
          tickFormatter={(value) => `$${Number(value).toLocaleString()}`}
        />
        <YAxis
          type="number"
          dataKey="transfer_value"
          name="Net Savings"
          unit="$"
          tickFormatter={(value) => `$${Number(value).toLocaleString()}`}
        />
        <ReferenceLine y={0} stroke="#8884d8" strokeDasharray="3 3" label={{ value: "Break-even", position: "right", fill: "#8884d8", fontSize: 11 }} />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(value: any, name: any) => {
          const label = typeof name === "string" ? name.replace(/_/g, " ") : String(name);
          return [`$${Number(value).toLocaleString()}`, label];
        }} />
        <Legend />

        <Scatter name="TRANSFER" data={transfer} fill="green" />
        <Scatter name="WAIT" data={wait} fill="red" />
      </ScatterChart>
    </ResponsiveContainer>
  );
}