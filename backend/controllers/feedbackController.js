import Feedback from "../models/Feedback.js";

export const getFeedbacks = async (req, res, next) => {
  try {
    const includeHidden = String(req.query.includeHidden || "false") === "true";

    const filter = includeHidden ? {} : { isHidden: false };

    const feedbacks = await Feedback.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: feedbacks.length,
      data: feedbacks
    });
  } catch (error) {
    next(error);
  }
};

export const getFeedbackById = async (req, res, next) => {
  try {
    const feedback = await Feedback.findById(req.params.id);

    if (!feedback) {
      res.status(404);
      throw new Error("Feedback not found");
    }

    res.json({
      success: true,
      data: feedback
    });
  } catch (error) {
    next(error);
  }
};

export const createFeedback = async (req, res, next) => {
  try {
    const { name, rating, text } = req.body;

    const feedback = await Feedback.create({
      name,
      rating,
      text
    });

    res.status(201).json({
      success: true,
      message: "Feedback added successfully",
      data: feedback
    });
  } catch (error) {
    next(error);
  }
};

export const updateFeedback = async (req, res, next) => {
  try {
    const feedback = await Feedback.findById(req.params.id);

    if (!feedback) {
      res.status(404);
      throw new Error("Feedback not found");
    }

    const updatedFeedback = await Feedback.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.json({
      success: true,
      message: "Feedback updated successfully",
      data: updatedFeedback
    });
  } catch (error) {
    next(error);
  }
};

export const setFeedbackHidden = async (req, res, next) => {
  try {
    const { isHidden } = req.body;

    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) {
      res.status(404);
      throw new Error("Feedback not found");
    }

    feedback.isHidden = Boolean(isHidden);
    await feedback.save();

    res.json({
      success: true,
      message: `Feedback ${feedback.isHidden ? "hidden" : "unhidden"} successfully`,
      data: feedback
    });
  } catch (error) {
    next(error);
  }
};

export const deleteFeedback = async (req, res, next) => {
  try {
    const feedback = await Feedback.findById(req.params.id);

    if (!feedback) {
      res.status(404);
      throw new Error("Feedback not found");
    }

    await feedback.deleteOne();

    res.json({
      success: true,
      message: "Feedback deleted successfully"
    });
  } catch (error) {
    next(error);
  }
};