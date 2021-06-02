/* eslint-disable @typescript-eslint/no-explicit-any */
import supertest from "supertest";
import express, { Application } from "express";
import { NextFunction, Request, Response } from "express";
import Logger from "bunyan";
import nock from "nock";
import { Installation, Subscription } from "../../../src/models";
import { mocked } from "ts-jest/utils";
import { mockModels } from "../../utils/models";

jest.mock("../../../src/models");

describe("API", () => {
  let app: Application;
  let locals;
  const invalidId = 99999999;
  const installationId = 1234;

  const successfulAuthResponseWrite = {
    data: {
      viewer: {
        login: "gimenete",
        isEmployee: true,
        organization: {
          repository: {
            viewerPermission: "WRITE"
          }
        }
      }
    }
  };

  const successfulAuthResponseAdmin = {
    data: {
      viewer: {
        login: "monalisa",
        isEmployee: true,
        organization: {
          repository: {
            viewerPermission: "ADMIN"
          }
        }
      }
    }
  };

  const createApp = async () => {
    const app = express();
    app.use((req: Request, res: Response, next: NextFunction) => {
      res.locals = locals || {};
      req.log = new Logger({
        name: "api.test.ts",
        level: "debug",
        stream: process.stdout
      });
      req.session = { jiraHost: process.env.ATLASSIAN_URL };
      next();
    });
    app.use("/api", (await import("../../../src/api")).default);
    return app;
  };

  beforeEach(async () => {
    locals = {
      client: {
        apps: {
          getInstallation: jest.fn().mockResolvedValue({ data: {} })
        }
      }
    };
    /*jiraClient = {
      devinfo: {
        migration: {
          undo: jest.fn(),
          complete: jest.fn()
        }
      }
    };*/
    app = await createApp();
  });

  describe("Authentication", () => {
    it("should return 404 if no token is provided", () => {
      nock("https://api.github.com")
        .post("/graphql")
        .reply(200, successfulAuthResponseWrite);

      return supertest(app)
        .get("/api")
        .expect(404)
        .then(response => {
          expect(response.body).toMatchSnapshot();
        });
    });

    it("should return 200 if a valid token is provided", () => {
      nock("https://api.github.com")
        .post("/graphql")
        .reply(200, successfulAuthResponseWrite);

      return supertest(app)
        .get("/api")
        .set("Authorization", "Bearer xxx")
        .expect(200)
        .then(response => {
          expect(response.body).toMatchSnapshot();
        });
    });

    it("should return 200 if token belongs to an admin", () => {
      nock("https://api.github.com")
        .post("/graphql")
        .reply(200, successfulAuthResponseAdmin);

      return supertest(app)
        .get("/api")
        .set("Authorization", "Bearer xxx")
        .expect(200)
        .then(response => {
          expect(response.body).toMatchSnapshot();
        });
    });

    it("should return 401 if the GraphQL query returns errors", () => {
      nock("https://api.github.com")
        .post("/graphql")
        .reply(200, {
          errors: [
            {
              path: [
                "query",
                "viewer",
                "isEmployeex"
              ],
              extensions: {
                code: "undefinedField",
                typeName: "User",
                fieldName: "isEmployeex"
              },
              locations: [
                {
                  line: 4,
                  column: 5
                }
              ],
              message: "Field 'isEmployeex' doesn't exist on type 'User'"
            }
          ]
        });

      return supertest(app)
        .get("/api")
        .set("Authorization", "Bearer xxx")
        .then(response => {
          expect(response.body).toMatchSnapshot();
          expect(response.status).toEqual(401);
        });
    });

    it("should return 401 if the returned organization is null", () => {
      nock("https://api.github.com")
        .post("/graphql")
        .reply(200, {
          data: {
            viewer: {
              login: "gimenete",
              isEmployee: true,
              organization: null
            }
          }
        });

      return supertest(app)
        .get("/api")
        .set("Authorization", "Bearer xxx")
        .expect(401)
        .then(response => {
          expect(response.body).toMatchSnapshot();
        });
    });

    it("should return 401 if the token is invalid", () => {
      nock("https://api.github.com")
        .post("/graphql")
        .reply(401, {
          HttpError: {
            message: "Bad credentials",
            documentation_url: "https://developer.github.com/v4"
          }
        });

      return supertest(app)
        .get("/api")
        .set("Authorization", "Bearer bad token")
        .expect(401)
        .then(response => {
          expect(response.body).toMatchSnapshot();
        });
    });
  });

  describe("Endpoints", () => {

    beforeEach(() => {
      nock("https://api.github.com")
        .post("/graphql")
        .reply(200, successfulAuthResponseWrite);
    });

    describe("installation", () => {
      it("should return 404 if no installation is found", async () => {
        mocked(Subscription.getAllForInstallation).mockResolvedValue([]);

        return supertest(app)
          .get(`/api/${invalidId}`)
          .set("Authorization", "Bearer xxx")
          .expect(404)
          .then(response => {
            expect(response.body).toMatchSnapshot();
          });
      });

      it("should return information for an existing installation", async () => {

        mocked(Subscription.getAllForInstallation).mockResolvedValue([
          {
            jiraHost: process.env.ATLASSIAN_URL,
            gitHubInstallationId: installationId
          }
        ] as any);

        return supertest(app)
          .get(`/api/${installationId}`)
          .set("Authorization", "Bearer xxx")
          .set("host", "127.0.0.1")
          .send("jiraHost=https://test-atlassian-instance.net")
          .expect(200)
          .then(response => {
            expect(response.body).toMatchSnapshot();
          });
      });
    });

    describe("repoSyncState", () => {
      it("should return 404 if no installation is found", async () => {
        mocked(Subscription.getSingleInstallation).mockResolvedValue(null);

        return supertest(app)
          .get(`/api/${invalidId}/repoSyncState.json`)
          .set("Authorization", "Bearer xxx")
          .expect(404)
          .then(response => {
            expect(response.body).toMatchSnapshot();
          });
      });

      it("should return the repoSyncState information for an existing installation", async () => {

        mocked(Subscription.getSingleInstallation).mockResolvedValue(mockModels.Subscription.getSingleInstallation);

        return supertest(app)
          .get(`/api/${installationId}/repoSyncState.json?jiraHost=https://test-atlassian-instance.net`)
          .set("Authorization", "Bearer xxx")
          .set("host", "127.0.0.1")
          .expect(200)
          .then(response => {
            expect(response.body).toMatchSnapshot();
          });
      });
    });

    describe("sync", () => {
      it("should return 404 if no installation is found", async () => {
        return supertest(app)
          .post(`/api/${invalidId}/sync`)
          .set("Authorization", "Bearer xxx")
          .send("jiraHost=https://unknownhost.atlassian.net")
          .expect(404)
          .then(response => {
            expect(response.text).toMatchSnapshot();
          });
      });

      it("should trigger the sync or start function", async () => {
        mocked(Subscription.getSingleInstallation)
          .mockResolvedValue(mockModels.Subscription.getSingleInstallation);
        return supertest(app)
          .post(`/api/${installationId}/sync`)
          .set("Authorization", "Bearer xxx")
          .set("host", "127.0.0.1")
          .send(`jiraHost=${process.env.ATLASSIAN_URL}`)
          .expect(202)
          .then(response => {
            expect(response.text).toMatchSnapshot();
            // td.verify(Subscription.findOrStartSync(subscription, null));
          });
      });

      it("should reset repoSyncState if asked to", async () => {
        mocked(Subscription.getSingleInstallation).mockResolvedValue(mockModels.Subscription.getSingleInstallation);
        return supertest(app)
          .post(`/api/${installationId}/sync`)
          .set("Authorization", "Bearer xxx")
          .set("host", "127.0.0.1")
          .send(`jiraHost=${process.env.ATLASSIAN_URL}`)
          .send("resetType=full")
          .expect(202)
          .then(response => {
            expect(response.text).toMatchSnapshot();
            // td.verify(Subscription.findOrStartSync(subscription, "full"));
          });
      });
    });

    describe("verify", () => {
      beforeEach(() => {
        mocked(Installation.findByPk).mockResolvedValue(mockModels.Installation.findByPk);
      });

      it("should return 'Installation already enabled'", () => {
        return supertest(app)
          .post(`/api/jira/${installationId}/verify`)
          .set("Authorization", "Bearer xxx")
          .expect(200)
          .expect("Content-Type", /json/)
          .then(response => expect(response.body.message).toMatchSnapshot());
      });
    });


    describe.skip("undo and complete - prod", () => {
      beforeEach(() => {
        process.env.NODE_ENV = "production";
      });

      afterEach(() => {
        process.env.NODE_ENV = "test";
      });

      it("should return 404 if no installation is found", async () => {
        return supertest(app)
          .post(`/api/${invalidId}/migrate/undo`)
          .set("Authorization", "Bearer xxx")
          .send("jiraHost=https://unknownhost.atlassian.net")
          .expect(404)
          .then(response => {
            expect(response.text).toMatchSnapshot();
          });
      });

      /**
       * We should be testing that instance.post (by mocking axios) has been called.
       * However, current implementation of tests causes state to override test internals.
       * TODO: after ticket #ARC-200 is completed, update this test.
       */
      it("should migrate an installation", () => {
        const update = jest.fn();
        mocked(Subscription.getSingleInstallation).mockResolvedValue({ update } as any);
        nock(process.env.ATLASSIAN_URL)
          .post("/rest/devinfo/0.10/github/migrationComplete")
          .reply(200);
        return supertest(app)
          .post(`/api/${installationId}/migrate`)
          .set("Authorization", "Bearer xxx")
          .set("host", "127.0.0.1")
          .send(`jiraHost=${process.env.ATLASSIAN_URL}`)
          .expect(200)
          .then(response => {
            expect(response.text).toMatchSnapshot();
            expect(update).toMatchSnapshot();
          });
      });

      /**
       * We should be testing that instance.post (by mocking axios) has been called.
       * However, current implementation of tests causes state to override test internals.
       * TODO: after ticket #ARC-200 is completed, update this test.
       */
      it("should undo a migration", async () => {
        const update = jest.fn();
        mocked(Subscription.getSingleInstallation).mockResolvedValue({ update } as any);
        nock(process.env.ATLASSIAN_URL)
          .post("/rest/devinfo/0.10/github/undoMigration")
          .reply(200);
        return supertest(app)
          .post(`/api/${installationId}/migrate/undo`)
          .set("Authorization", "Bearer xxx")
          .set("host", "127.0.0.1")
          .send(`jiraHost=${process.env.ATLASSIAN_URL}`)
          .expect(200)
          .then(response => {
            expect(response.text).toMatchSnapshot();
            expect(update).toMatchSnapshot();
          });
      });
    });

    describe("undo and complete - nonprod", () => {
      /**
       * We should be testing that instance.post (by mocking axios) has not been called.
       * However, current implementation of tests causes state to override test internals.
       * TODO: after ticket #ARC-200 is completed, update this test.
       */
      it("should not migrate an installation", async () => {
        const update = jest.fn();
        mocked(Subscription.getSingleInstallation).mockResolvedValue({ update } as any);
        nock(process.env.ATLASSIAN_URL)
          .post("/rest/devinfo/0.10/github/migrationComplete")
          .reply(200);
        return supertest(app)
          .post(`/api/${installationId}/migrate`)
          .set("Authorization", "Bearer xxx")
          .set("host", "127.0.0.1")
          .send(`jiraHost=${process.env.ATLASSIAN_URL}`)
          .expect(200)
          .then(response => {
            expect(response.text).toMatchSnapshot();
            expect(update).toMatchSnapshot();
          });
      });

      /**
       * We should be testing that instance.post (by mocking axios) has not been called.
       * However, current implementation of tests causes state to override test internals.
       * TODO: after ticket #ARC-200 is completed, update this test.
       */
      it("should not undo a migration", async () => {
        const update = jest.fn();
        mocked(Subscription.getSingleInstallation).mockResolvedValue({ update } as any);
        nock(process.env.ATLASSIAN_URL)
          .post("/rest/devinfo/0.10/github/undoMigration")
          .reply(200);
        return supertest(app)
          .post(`/api/${installationId}/migrate/undo`)
          .set("Authorization", "Bearer xxx")
          .set("host", "127.0.0.1")
          .send(`jiraHost=${process.env.ATLASSIAN_URL}`)
          .expect(200)
          .then(response => {
            expect(response.text).toMatchSnapshot();
            expect(update).toMatchSnapshot();
          });
      });
    });
  });
});