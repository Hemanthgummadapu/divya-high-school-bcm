# Run the site locally

1. **Start the server** (in terminal from project folder):

   **Option A – recommended (frees port 3001 first):**
   ```
   .\dev.ps1
   ```

   **Option B – if you get "address already in use":**
   Run `.\dev.ps1` instead, or close any other terminal running `npm run dev`, then run:
   ```
   npm run dev
   ```

   Wait until you see: `Local: http://localhost:3001`

2. **Open in Chrome** — use one of these **exact** URLs in the address bar (copy-paste):
   - **http://localhost:3001**
   - **http://127.0.0.1:3001**

   Important: type the full URL including `http://`. If you type only `localhost:3001`, Chrome may show a Google search instead of your site.

3. Press **Enter**. You should see the Divya High School homepage.

4. **First time only:** The first time you open the URL, the page can take **1–2 minutes** to load while Next.js compiles. Watch the terminal: you’ll see `Compiling /` then `Compiled in ...`. After that, the page loads and future reloads are fast.

5. When done, press **Ctrl+C** in the terminal to stop the server.
