
# Mapper: Cursor for Maps


## **Live demo:** [https://map-agent.sunny-jyrm.workers.dev/](https://map-agent.sunny-jyrm.workers.dev/)
### Build upon the Cloudflare agents framework (9/10 developer experience BTW! Good Job!)

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
4. Map and agent state are persisted remotely for convenience



## How to Use It

You interact with the map by chatting in plain English. The agent extracts addresses for geocoding (address → lat/long) and puts any extra details (like building name or year opened) into **notes**. 
### Example 1 — Add three apartments
> Im interested in these 3 apartments. Put the name in the notes (dont incude it in the address when geocoding) . also put the opened year in the notes  
> The Standard at Berkeley — 2580 Bancroft Way, Berkeley, CA 94704 — built in 2021. Apartments.com +1  
> Garden Village (now “FOUND Study Southside”) — 2201 Dwight Way, Berkeley, CA 94704 — built in 2016. Franklin Street +1  
> Enclave Apartments — 2503 Haste St, Berkeley, CA 94704 — opened/built in 2020.

### Example 2 — Add a landmark and recolor a pin
> plot salesforce tower in blue and change enclave to green

