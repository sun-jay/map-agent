
# Mapper: Cursor for Maps

## **Live demo:** [https://map-agent.sunny-jyrm.workers.dev/](https://map-agent.sunny-jyrm.workers.dev/)

## Quick Start

1. **Install**
```bash
npm install
```

2. **Set up your environment**

Create a `.dev.vars` file:

```env
OPENAI_API_KEY=your_openai_api_key
```

3. **Run locally**

```bash
npm start
```

## Under the Hood

1. Uses OpenAI GPT-4o to power the agent
2. Cloudflare Worker coordinates geocoding (convert address → lat/long)
3. Chatbot UI lets you “chat with your map”
4. Map and agent state are persisted remotely 


