import mongoose from 'mongoose';

export const MESSAGE_ROLES = ['user', 'assistant'];

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: MESSAGE_ROLES, required: true },
    content: { type: String, required: true, maxlength: 20000 },
    clientMessageId: { type: String },
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    model: { type: String },
    usage: {
      promptTokens: Number,
      completionTokens: Number,
      totalTokens: Number,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        const json = {
          id: ret._id.toString(),
          conversationId: ret.conversation.toString(),
          role: ret.role,
          content: ret.content,
          createdAt: ret.createdAt,
        };
        if (ret.clientMessageId) json.clientMessageId = ret.clientMessageId;
        if (ret.replyTo) json.replyTo = ret.replyTo.toString();
        if (ret.model) json.model = ret.model;
        return json;
      },
    },
  },
);

messageSchema.index({ conversation: 1, createdAt: 1, _id: 1 });
messageSchema.index({ user: 1, conversation: 1 });
messageSchema.index(
  { user: 1, clientMessageId: 1 },
  { unique: true, partialFilterExpression: { clientMessageId: { $type: 'string' } } },
);

export const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);
