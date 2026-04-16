import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
  {
    name: { type: String, default: "Anonymous", trim: true },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot be greater than 5"]
    },
    text: { type: String, required: [true, "Feedback text is required"], trim: true },

    // NEW:
    isHidden: { type: Boolean, default: false }
  },
  { timestamps: true }
);

feedbackSchema.index({ isHidden: 1, createdAt: -1 });

const Feedback = mongoose.model("Feedback", feedbackSchema);
export default Feedback;