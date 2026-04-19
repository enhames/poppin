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
import { fmtMoney } from "../utils/format";

type Item = {
    item_name: string,
    transfer_cost: number,
    avoided_penalty: number,
    transfer_value: number,
    recommendation: string
}

export default function ScatterPlot({data}: {data: Item[]}){
    const transfer = data.filter(d => d.recommendation === "TRANSFER");
    const wait = data.filter(d => d.recommendation === "WAIT");

    return (
    <ResponsiveContainer width="100%" height={400}>
      <ScatterChart>
        <CartesianGrid />
        <XAxis
          type="number"
          dataKey="transfer_cost"
          name="Transfer Cost"
        />
        <YAxis
          type="number"
          dataKey="transfer_value"
          name="Net Savings"
          unit="$"
        />
        <ReferenceLine y={0} stroke="#8884d8" strokeDasharray="3 3" label={{ value: "Break-even", position: "right", fill: "#8884d8", fontSize: 11 }} />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(value: any, name: any) => {
          const label = typeof name === "string" ? name.replace(/_/g, " ") : String(name);
          return [`$${fmtMoney(Number(value))}`, label];
        }} />
        <Legend />

        <Scatter name="TRANSFER" data={transfer} fill="green" />
        <Scatter name="WAIT" data={wait} fill="red" />
      </ScatterChart>
    </ResponsiveContainer>
  );
}