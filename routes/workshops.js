import express from "express";
import models from "../models";

const router = express.Router();

// Get workshops
router.get("/workshops", (req, res) => {
  models.workshop
    .findAll({
      raw: true
    })
    .then(entries => res.send(entries));
});

export default router;
