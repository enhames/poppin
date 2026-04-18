import {
    ScatterChart, 
    Scatter,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ResponsiveContainer,
    Legend
} from "recharts";

type Item = {
    item_name: string,
    transfer_cost: number,
    avoided_penalty: number,
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
          dataKey="avoided_penalty"
          name="Avoided Penalty"
        />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} />
        <Legend />

        <Scatter name="TRANSFER" data={transfer} fill="green" />
        <Scatter name="WAIT" data={wait} fill="red" />
      </ScatterChart>
    </ResponsiveContainer>
  );
}