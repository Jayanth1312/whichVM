import { Router } from "express";
import pingRouter from "./ping.api";
import cronRouter from "./cron.api";
import dataRouter from "./data.api";
import instancesRouter from "./instances.api";

const router = Router();

router.use(pingRouter);
router.use(cronRouter);
router.use(dataRouter);
router.use(instancesRouter);

export default router;
