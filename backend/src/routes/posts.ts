// @ts-nocheck
const express = require('express');
const router = express.Router();
const { getPosts, getPostById, getMoodStats, searchPosts, createPost, updatePost, toggleLike, toggleReaction, toggleRelatable, reportPost, deletePost, getAiTip } = require('../controllers/postController');
const { getComments, addComment, deleteComment } = require('../controllers/commentController');

const { protect } = require('../middleware/auth');
const { aiTipLimiter, createPostLimiter, interactionLimiter, commentLimiter } = require('../middleware/rateLimit');
const { optionalAuth } = require('../middleware/optionalAuth');

router.get('/', optionalAuth, getPosts);
router.get('/search', optionalAuth, searchPosts);
router.get('/stats/mood', getMoodStats);
router.post('/', protect, createPostLimiter, createPost);
router.patch('/:id', protect, createPostLimiter, updatePost);
router.post('/ai/tip', protect, aiTipLimiter, getAiTip);
router.get('/:id', optionalAuth, getPostById);
router.get('/:id/comments', optionalAuth, getComments);
router.post('/:id/comments', protect, commentLimiter, addComment);
router.delete('/:id/comments/:commentId', protect, interactionLimiter, deleteComment);
router.post('/:id/like', protect, interactionLimiter, toggleLike);
router.post('/:id/reaction', protect, interactionLimiter, toggleReaction);
router.post('/:id/relatable', protect, interactionLimiter, toggleRelatable);
router.post('/:id/report', protect, interactionLimiter, reportPost);
router.delete('/:id', protect, deletePost);

module.exports = router;