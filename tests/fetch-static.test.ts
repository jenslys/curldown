import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse
} from "node:http";
import { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { FetchError } from "../src/errors.js";
import { fetchStaticHtml } from "../src/fetch-static.js";

type RequestHandler = (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => void;

async function startServer(handler: RequestHandler): Promise<Server> {
  const server = createServer(handler);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  return server;
}

async function stopServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

describe("fetchStaticHtml", () => {
  const servers: Server[] = [];

  afterEach(async () => {
    for (const server of servers) {
      await stopServer(server);
    }
    servers.length = 0;
  });

  it("fetches html successfully", async () => {
    const server = await startServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<html><body><h1>Hello</h1></body></html>");
    });
    servers.push(server);

    const address = server.address() as AddressInfo;
    const result = await fetchStaticHtml({
      url: `http://127.0.0.1:${address.port}`,
      timeoutMs: 5_000,
      headers: {}
    });

    expect(result.body).toContain("<h1>Hello</h1>");
    expect(result.status).toBe(200);
    expect(result.contentType).toContain("text/html");
  });

  it("fails on non-2xx responses", async () => {
    const server = await startServer((_req, res) => {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end("server error");
    });
    servers.push(server);

    const address = server.address() as AddressInfo;

    await expect(
      fetchStaticHtml({
        url: `http://127.0.0.1:${address.port}`,
        timeoutMs: 5_000,
        headers: {}
      })
    ).rejects.toBeInstanceOf(FetchError);
  });
});
