import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    lastMessageAt: { type: Date, required: true, default: Date.now },
    messageCount: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        return {
          id: ret._id.toString(),
          title: ret.title,
          lastMessageAt: ret.lastMessageAt,
          messageCount: ret.messageCount,
          createdAt: ret.createdAt,
          updatedAt: ret.updatedAt,
        };
      },
    },
  },
);

conversationSchema.index({ user: 1, lastMessageAt: -1 });

export const Conversation =
  mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);
