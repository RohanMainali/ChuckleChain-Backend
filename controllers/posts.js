const Post = require("../models/Post");
const User = require("../models/User");
const Notification = require("../models/Notification");

// @desc    Create a new post
// @route   POST /api/posts
// @access  Private
exports.createPost = async (req, res) => {
  try {
    const { text, image, category, memeTexts, captionPlacement } = req.body;

    // Validate required fields
    if (!text || !image) {
      return res.status(400).json({
        success: false,
        message: "Please provide text and image for the post",
      });
    }

    // Create post
    const post = await Post.create({
      user: req.user.id,
      text,
      image,
      category,
      memeTexts,
      captionPlacement,
    });

    // Extract hashtags from text
    const hashtagRegex = /#(\w+)/g;
    const hashtags = text.match(hashtagRegex);

    if (hashtags) {
      post.hashtags = hashtags.map((tag) => tag.substring(1));
      await post.save();
    }

    // Update user streak
    const { updateUserStreak } = require("./users");
    await updateUserStreak(req.user.id);

    // Populate user data
    await post.populate({
      path: "user",
      select: "username profilePicture",
    });

    res.status(201).json({
      success: true,
      data: {
        id: post._id,
        text: post.text,
        image: post.image,
        createdAt: post.createdAt,
        likes: 0,
        isLiked: false,
        comments: [],
        category: post.category,
        memeTexts: post.memeTexts,
        captionPlacement: post.captionPlacement,
        user: {
          id: post.user._id,
          username: post.user.username,
          profilePicture: post.user.profilePicture,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get all posts (feed)
// @route   GET /api/posts
// @access  Private
exports.getPosts = async (req, res) => {
  try {
    // Get posts from users the current user follows + own posts
    const user = await User.findById(req.user.id);
    const following = user.following;
    following.push(req.user.id); // Include own posts

    const posts = await Post.find({ user: { $in: following } })
      .sort({ createdAt: -1 })
      .populate({
        path: "user",
        select: "username profilePicture",
      })
      .populate({
        path: "comments.user",
        select: "username profilePicture",
      });

    res.status(200).json({
      success: true,
      data: posts.map((post) => ({
        id: post._id,
        text: post.text,
        image: post.image,
        createdAt: post.createdAt,
        likes: post.likeCount,
        isLiked: post.likes.includes(req.user.id),
        comments: post.comments.map((comment) => ({
          id: comment._id,
          user: comment.user.username,
          profilePicture: comment.user.profilePicture,
          text: comment.text,
          replyTo: comment.replyTo,
          timestamp: comment.createdAt,
          likeCount: comment.likes ? comment.likes.length : 0,
          isLiked: comment.likes ? comment.likes.includes(req.user.id) : false,
        })),
        category: post.category,
        memeTexts: post.memeTexts,
        captionPlacement: post.captionPlacement,
        user: {
          id: post.user._id,
          username: post.user.username,
          profilePicture: post.user.profilePicture,
        },
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get trending posts
// @route   GET /api/posts/trending
// @access  Private
exports.getTrendingPosts = async (req, res) => {
  try {
    // Get time frame from query params (default to 7 days)
    const timeFrame = req.query.timeFrame || "week";

    // Calculate the date range based on the timeFrame
    const now = new Date();
    let startDate;

    switch (timeFrame) {
      case "day":
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case "week":
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case "month":
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      default:
        startDate = new Date(now.setDate(now.getDate() - 7));
    }

    // Get posts with most likes in the specified time frame
    // If no posts in that time frame, get all posts sorted by likes
    let posts = await Post.find({ createdAt: { $gte: startDate } })
      .sort({ likes: -1 })
      .limit(10)
      .populate({
        path: "user",
        select: "username profilePicture",
      })
      .populate({
        path: "comments.user",
        select: "username profilePicture",
      });

    // If no posts found in the time frame, get all posts
    if (posts.length === 0) {
      posts = await Post.find()
        .sort({ likes: -1 })
        .limit(10)
        .populate({
          path: "user",
          select: "username profilePicture",
        })
        .populate({
          path: "comments.user",
          select: "username profilePicture",
        });
    }

    res.status(200).json({
      success: true,
      data: posts.map((post) => ({
        id: post._id,
        text: post.text,
        image: post.image,
        createdAt: post.createdAt,
        likes: post.likeCount,
        isLiked: post.likes.includes(req.user.id),
        comments: post.comments.map((comment) => ({
          id: comment._id,
          user: comment.user.username,
          profilePicture: comment.user.profilePicture,
          text: comment.text,
          replyTo: comment.replyTo,
          timestamp: comment.createdAt,
          likeCount: comment.likes ? comment.likes.length : 0,
          isLiked: comment.likes ? comment.likes.includes(req.user.id) : false,
        })),
        category: post.category,
        memeTexts: post.memeTexts,
        captionPlacement: post.captionPlacement,
        user: {
          id: post.user._id,
          username: post.user.username,
          profilePicture: post.user.profilePicture,
        },
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get fresh posts
// @route   GET /api/posts/fresh
// @access  Private
exports.getFreshPosts = async (req, res) => {
  try {
    // Get most recent posts
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .populate({
        path: "user",
        select: "username profilePicture",
      })
      .populate({
        path: "comments.user",
        select: "username profilePicture",
      });

    res.status(200).json({
      success: true,
      data: posts.map((post) => ({
        id: post._id,
        text: post.text,
        image: post.image,
        createdAt: post.createdAt,
        likes: post.likeCount,
        isLiked: post.likes.includes(req.user.id),
        comments: post.comments.map((comment) => ({
          id: comment._id,
          user: comment.user.username,
          profilePicture: comment.user.profilePicture,
          text: comment.text,
          replyTo: comment.replyTo,
          timestamp: comment.createdAt,
          likeCount: comment.likes ? comment.likes.length : 0,
          isLiked: comment.likes ? comment.likes.includes(req.user.id) : false,
        })),
        category: post.category,
        memeTexts: post.memeTexts,
        captionPlacement: post.captionPlacement,
        user: {
          id: post.user._id,
          username: post.user.username,
          profilePicture: post.user.profilePicture,
        },
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get posts by category
// @route   GET /api/posts/category/:category
// @access  Private
exports.getCategoryPosts = async (req, res) => {
  try {
    const { category } = req.params;

    const posts = await Post.find({ category })
      .sort({ createdAt: -1 })
      .populate({
        path: "user",
        select: "username profilePicture",
      })
      .populate({
        path: "comments.user",
        select: "username profilePicture",
      });

    res.status(200).json({
      success: true,
      data: posts.map((post) => ({
        id: post._id,
        text: post.text,
        image: post.image,
        createdAt: post.createdAt,
        likes: post.likeCount,
        isLiked: post.likes.includes(req.user.id),
        comments: post.comments.map((comment) => ({
          id: comment._id,
          user: comment.user.username,
          profilePicture: comment.user.profilePicture,
          text: comment.text,
          replyTo: comment.replyTo,
          timestamp: comment.createdAt,
          likeCount: comment.likes ? comment.likes.length : 0,
          isLiked: comment.likes ? comment.likes.includes(req.user.id) : false,
        })),
        category: post.category,
        memeTexts: post.memeTexts,
        captionPlacement: post.captionPlacement,
        user: {
          id: post.user._id,
          username: post.user.username,
          profilePicture: post.user.profilePicture,
        },
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get posts by hashtag
// @route   GET /api/posts/hashtag/:tag
// @access  Private
exports.getHashtagPosts = async (req, res) => {
  try {
    const { tag } = req.params;

    const posts = await Post.find({ hashtags: tag })
      .sort({ createdAt: -1 })
      .populate({
        path: "user",
        select: "username profilePicture",
      })
      .populate({
        path: "comments.user",
        select: "username profilePicture",
      });

    res.status(200).json({
      success: true,
      data: posts.map((post) => ({
        id: post._id,
        text: post.text,
        image: post.image,
        createdAt: post.createdAt,
        likes: post.likeCount,
        isLiked: post.likes.includes(req.user.id),
        comments: post.comments.map((comment) => ({
          id: comment._id,
          user: comment.user.username,
          profilePicture: comment.user.profilePicture,
          text: comment.text,
          replyTo: comment.replyTo,
          timestamp: comment.createdAt,
          likeCount: comment.likes ? comment.likes.length : 0,
          isLiked: comment.likes ? comment.likes.includes(req.user.id) : false,
        })),
        category: post.category,
        memeTexts: post.memeTexts,
        captionPlacement: post.captionPlacement,
        user: {
          id: post.user._id,
          username: post.user.username,
          profilePicture: post.user.profilePicture,
        },
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get a single post
// @route   GET /api/posts/:id
// @access  Private
exports.getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate({
        path: "user",
        select: "username profilePicture",
      })
      .populate({
        path: "comments.user",
        select: "username profilePicture",
      });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: post._id,
        text: post.text,
        image: post.image,
        createdAt: post.createdAt,
        likes: post.likeCount,
        isLiked: post.likes.includes(req.user.id),
        comments: post.comments.map((comment) => ({
          id: comment._id,
          user: comment.user.username,
          profilePicture: comment.user.profilePicture,
          text: comment.text,
          replyTo: comment.replyTo,
          timestamp: comment.createdAt,
          likeCount: comment.likes ? comment.likes.length : 0,
          isLiked: comment.likes ? comment.likes.includes(req.user.id) : false,
        })),
        category: post.category,
        memeTexts: post.memeTexts,
        captionPlacement: post.captionPlacement,
        user: {
          id: post.user._id,
          username: post.user.username,
          profilePicture: post.user.profilePicture,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update a post
// @route   PUT /api/posts/:id
// @access  Private
exports.updatePost = async (req, res) => {
  try {
    let post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Make sure user owns the post
    if (post.user.toString() !== req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to update this post",
      });
    }

    const { text, category, memeTexts, captionPlacement } = req.body;

    // Build update object
    const updateFields = {};
    if (text !== undefined) {
      updateFields.text = text;

      // Update hashtags if text changed
      const hashtagRegex = /#(\w+)/g;
      const hashtags = text.match(hashtagRegex);

      if (hashtags) {
        updateFields.hashtags = hashtags.map((tag) => tag.substring(1));
      } else {
        updateFields.hashtags = [];
      }
    }
    if (category !== undefined) updateFields.category = category;
    if (memeTexts !== undefined) updateFields.memeTexts = memeTexts;
    if (captionPlacement !== undefined)
      updateFields.captionPlacement = captionPlacement;

    post = await Post.findByIdAndUpdate(req.params.id, updateFields, {
      new: true,
      runValidators: true,
    }).populate({
      path: "user",
      select: "username profilePicture",
    });

    res.status(200).json({
      success: true,
      data: {
        id: post._id,
        text: post.text,
        image: post.image,
        createdAt: post.createdAt,
        likes: post.likeCount,
        isLiked: post.likes.includes(req.user.id),
        comments: post.comments.map((comment) => ({
          id: comment._id,
          user: comment.user.username,
          profilePicture: comment.user.profilePicture,
          text: comment.text,
          replyTo: comment.replyTo,
          timestamp: comment.createdAt,
          likeCount: comment.likes ? comment.likes.length : 0,
          isLiked: comment.likes ? comment.likes.includes(req.user.id) : false,
        })),
        category: post.category,
        memeTexts: post.memeTexts,
        captionPlacement: post.captionPlacement,
        user: {
          id: post.user._id,
          username: post.user.username,
          profilePicture: post.user.profilePicture,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete a post
// @route   DELETE /api/posts/:id
// @access  Private
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Make sure user owns the post
    if (post.user.toString() !== req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to delete this post",
      });
    }

    await post.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Like/unlike a post
// @route   PUT /api/posts/:id/like
// @access  Private
exports.likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Check if the post has already been liked
    const isLiked = post.likes.includes(req.user.id);

    if (isLiked) {
      // Unlike
      post.likes = post.likes.filter((like) => like.toString() !== req.user.id);
    } else {
      // Like
      post.likes.push(req.user.id);

      // Create notification if the post is not by the current user
      if (post.user.toString() !== req.user.id) {
        await Notification.create({
          recipient: post.user,
          sender: req.user.id,
          type: "like",
          post: post._id,
        });
      }
    }

    await post.save();

    res.status(200).json({
      success: true,
      data: {
        isLiked: !isLiked,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Add comment to a post
// @route   POST /api/posts/:id/comments
// @access  Private
exports.addComment = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: "Please provide comment text",
      });
    }

    const comment = {
      user: req.user.id,
      text,
      createdAt: new Date(),
      likes: [],
    };

    post.comments.push(comment);
    await post.save();

    // Get the newly added comment
    const newComment = post.comments[post.comments.length - 1];

    // Create notification if the post is not by the current user
    if (post.user.toString() !== req.user.id) {
      await Notification.create({
        recipient: post.user,
        sender: req.user.id,
        type: "comment",
        post: post._id,
        comment: newComment._id,
        content: text,
      });
    }

    // Populate user data for the comment
    await post.populate({
      path: "comments.user",
      select: "username profilePicture",
    });

    // Find the populated comment
    const populatedComment = post.comments.id(newComment._id);

    res.status(200).json({
      success: true,
      data: {
        id: populatedComment._id,
        user: populatedComment.user.username,
        profilePicture: populatedComment.user.profilePicture,
        text: populatedComment.text,
        timestamp: populatedComment.createdAt,
        likeCount: 0,
        isLiked: false,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Like/unlike a comment
// @route   PUT /api/posts/:id/comments/:commentId/like
// @access  Private
exports.likeComment = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Find the comment
    const comment = post.comments.id(req.params.commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check if the comment has already been liked
    const isLiked = comment.likes && comment.likes.includes(req.user.id);

    if (isLiked) {
      // Unlike
      comment.likes = comment.likes.filter(
        (like) => like.toString() !== req.user.id
      );
    } else {
      // Like
      if (!comment.likes) {
        comment.likes = [];
      }
      comment.likes.push(req.user.id);
    }

    await post.save();

    res.status(200).json({
      success: true,
      data: {
        isLiked: !isLiked,
        likeCount: comment.likes.length,
      },
    });
  } catch (error) {
    console.error("Error liking comment:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Reply to a comment
// @route   POST /api/posts/:id/comments/:commentId/reply
// @access  Private
exports.replyToComment = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Find the parent comment
    const parentComment = post.comments.id(req.params.commentId);

    if (!parentComment) {
      return res.status(404).json({
        success: false,
        message: "Parent comment not found",
      });
    }

    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: "Please provide reply text",
      });
    }

    // Create the reply comment
    const reply = {
      user: req.user.id,
      text,
      replyTo: parentComment._id,
      createdAt: new Date(),
      likes: [],
    };

    // Add the reply to the post's comments array
    post.comments.push(reply);
    await post.save();

    // Get the newly added reply
    const newReply = post.comments[post.comments.length - 1];

    // Populate user data for the reply
    await post.populate({
      path: "comments.user",
      select: "username profilePicture",
    });

    // Find the populated reply
    const populatedReply = post.comments.id(newReply._id);

    // Create notification for the comment owner if it's not the current user
    if (parentComment.user.toString() !== req.user.id) {
      await Notification.create({
        recipient: parentComment.user,
        sender: req.user.id,
        type: "comment",
        post: post._id,
        comment: newReply._id,
        content: text,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: populatedReply._id,
        user: populatedReply.user.username,
        profilePicture: populatedReply.user.profilePicture,
        text: populatedReply.text,
        replyTo: populatedReply.replyTo,
        createdAt: populatedReply.createdAt,
        likeCount: 0,
        isLiked: false,
      },
    });
  } catch (error) {
    console.error("Error replying to comment:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete comment from a post
// @route   DELETE /api/posts/:id/comments/:commentId
// @access  Private
exports.deleteComment = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Find the comment
    const comment = post.comments.id(req.params.commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Make sure user owns the comment or the post
    if (
      comment.user.toString() !== req.user.id &&
      post.user.toString() !== req.user.id
    ) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to delete this comment",
      });
    }

    // Remove the comment
    comment.deleteOne();

    // Also remove any replies to this comment
    post.comments = post.comments.filter(
      (c) => !c.replyTo || c.replyTo.toString() !== req.params.commentId
    );

    await post.save();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
