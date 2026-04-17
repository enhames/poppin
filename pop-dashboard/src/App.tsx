import { Card, Text, Metric, Badge } from "@tremor/react";

function App() {
  return (
    <div className="p-10">
      <Card className="max-w-md mx-auto">
        <Text>Emerging Trend</Text>
        <Metric>Ube Latte Powder</Metric>
        <div className="mt-4 flex gap-2">
          <Badge color="green">FDA Compliant</Badge>
          <Badge color="yellow">Tariff Risk: 10%</Badge>
        </div>
      </Card>
    </div>
  );
}

export default App;