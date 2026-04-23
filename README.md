# Pop-Ops: Inventory Command Center
**1st Place Winner - Hack The Coast 2026 (Prince of Peace Supply Chain Track)**

Pop-Ops is an intelligent decision-support tool designed to shift enterprise fulfillment from a reactionary scramble into a proactive strategy. Built specifically for Prince of Peace, Pop-Ops provides multi-site visibility and autonomous transfer recommendations to mitigate the company's ~$700,000 annual chargeback exposure caused by short-ship and late-delivery penalties.

## The Business Value
* **Exception-Based Management:** Hides "healthy" inventory to reduce cognitive load. The UI strictly surfaces items that are projected to stock out within 14 days or are flagged as dead weight.
* **Cost Tradeoff Engine:** Dynamically compares the cost of an emergency inter-DC freight transfer against historical retailer chargeback penalties. It only recommends a transfer if it mathematically saves the company money.
* **Strict Visual Hierarchy:** Designed with operational psychology in mind. Primary brand colors are reserved strictly for high financial risk and critical action buttons.

## Tech Stack
**Frontend**
* **React + TypeScript:** Component-driven UI.
* **Vite:** Next-generation, ultra-fast frontend tooling.
* **Tailwind CSS:** Utility-first framework for custom design systems and strict visual hierarchy.
* **Recharts:** Composable charting library for rendering live inventory data.

**Backend & Data**
* **Python:** Core backend logic.
* **Flask:** Lightweight WSGI web application framework to serve API endpoints.
* **Pandas:** Heavy-duty data processing, merging inventory snapshots, and calculating burn rates.
* **File Processing:** Ingests and normalizes multi-unit CSV and Excel files into clean JSON for the frontend.

---

## Local Setup & Installation

### Prerequisites
Before you begin, ensure you have the following installed on your machine:
* **Python 3**
* **Node.js**

### Installation Steps
From the root `poppin` directory, follow these 5 steps to set up the environments and run the app. 

**1 & 2. Set up the Python Virtual Environment**
Navigate to the backend folder, create the virtual environment, and install the required dependencies:

    cd backend
    python3 -m venv .venv
    .venv/bin/pip install -r requirements.txt

**3 & 4. Set up Node Dependencies**
Navigate to the frontend folder and install the legacy peer dependencies:

    cd ../pop-dashboard
    npm install --legacy-peer-deps

**5. Run the Application**
Start both the React frontend and the Flask backend simultaneously using the concurrent dev script:

    npm run dev:all

*(Note for developers: Ensure the `dev:all` script in `package.json` is configured to point to the correct Python path: `../backend/.venv/bin/python`)*

---

## Phase 2 Roadmap
As we look toward deploying Pop-Ops at enterprise scale, our immediate next steps include:
1. **Data Pipeline Migration:** Transitioning from static file ingestion to a fully hosted AWS S3 environment for continuous, automated data syncing.
2. **Relational Database:** Implementing a dynamic database to allow for real-time, product-by-product recalculations.
3. **Carrier API Integration:** Upgrading our webhook architecture into a direct API integration with freight carriers so the "Transfer" button can autonomously dispatch trucks.
4. **Proactive Alerts:** Building an automated notification system via email/SMS.

---

## The Coding Kitties
* **Daniel Pulikkottil** - [[LinkedIn](https://www.linkedin.com/in/daniel-pulikkottil/)]
* **Emily Hames** - [[LinkedIn](https://www.linkedin.com/in/emily-hames/)]
* **Shyamak Pal** - [[LinkedIn](https://www.linkedin.com/in/shyamakpal/)]
* **Spencer Leaf** - [[LinkedIn](https://www.linkedin.com/in/spencerarleaf/)]
* **Ryan Tapia** - [[LinkedIn](https://www.linkedin.com/in/ryan-tapiaswe27/)]
