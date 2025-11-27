import { Router, type Request, type Response } from 'express';
import { TaskService } from '../services/taskService';
import { authenticateToken, requireRole } from '../middleware/auth';
import pool from '../config/database';

const router = Router();

/**
 * 获取任务列表
 * GET /api/tasks
 */
router.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { skip, limit, enabled, group_id, keyword } = req.query;
    
    const params: any = {};
    if (skip) params.skip = parseInt(skip as string);
    if (limit) params.limit = parseInt(limit as string);
    if (enabled !== undefined) params.enabled = enabled === 'true';
    if (group_id) params.group_id = parseInt(group_id as string);
    if (keyword) params.keyword = keyword as string;

    const result = await TaskService.getTasks(params);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error('获取任务列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取任务列表失败'
    });
  }
});

/**
 * 任务分组列表
 * GET /api/tasks/groups
 */
router.get('/groups', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query('SELECT id, name FROM demo1.task_groups ORDER BY name ASC');
    res.json({ success: true, items: rows });
  } catch (error: any) {
    console.error('获取任务分组错误:', error);
    res.status(500).json({ success: false, message: '获取任务分组失败' });
  }
});

/**
 * 获取单个任务
 * GET /api/tasks/:id
 */
router.get('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = parseInt(req.params.id);
    
    if (isNaN(taskId)) {
      res.status(400).json({
        success: false,
        message: '无效的任务ID'
      });
      return;
    }

    const task = await TaskService.getTaskById(taskId);
    
    if (!task) {
      res.status(404).json({
        success: false,
        message: '任务不存在'
      });
      return;
    }

    res.json({
      success: true,
      data: task
    });
  } catch (error: any) {
    console.error('获取任务错误:', error);
    res.status(500).json({
      success: false,
      message: '获取任务失败'
    });
  }
});

/**
 * 创建任务
 * POST /api/tasks
 */
router.post('/', authenticateToken, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const taskData = req.body;
    
    // 基础验证
    if (!taskData.name || !taskData.cron_expression || !taskData.task_type) {
      res.status(400).json({
        success: false,
        message: '缺少必要参数：name, cron_expression, task_type'
      });
      return;
    }

    const task = await TaskService.createTask(taskData);
    
    res.status(201).json({
      success: true,
      data: task,
      message: '任务创建成功'
    });
  } catch (error: any) {
    console.error('创建任务错误:', error);
    res.status(500).json({
      success: false,
      message: '创建任务失败'
    });
  }
});

/**
 * 更新任务
 * PUT /api/tasks/:id
 */
router.put('/:id', authenticateToken, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = parseInt(req.params.id);
    const taskData = req.body;
    
    if (isNaN(taskId)) {
      res.status(400).json({
        success: false,
        message: '无效的任务ID'
      });
      return;
    }

    const task = await TaskService.updateTask(taskId, taskData);
    
    if (!task) {
      res.status(404).json({
        success: false,
        message: '任务不存在'
      });
      return;
    }

    res.json({
      success: true,
      data: task,
      message: '任务更新成功'
    });
  } catch (error: any) {
    console.error('更新任务错误:', error);
    res.status(500).json({
      success: false,
      message: '更新任务失败'
    });
  }
});

/**
 * 删除任务
 * DELETE /api/tasks/:id
 */
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = parseInt(req.params.id);
    
    if (isNaN(taskId)) {
      res.status(400).json({
        success: false,
        message: '无效的任务ID'
      });
      return;
    }

    const success = await TaskService.deleteTask(taskId);
    
    if (!success) {
      res.status(404).json({
        success: false,
        message: '任务不存在'
      });
      return;
    }

    res.json({
      success: true,
      message: '任务删除成功'
    });
  } catch (error: any) {
    console.error('删除任务错误:', error);
    res.status(500).json({
      success: false,
      message: '删除任务失败'
    });
  }
});

/**
 * 启用/禁用任务
 * POST /api/tasks/:id/enable
 */
router.post('/:id/enable', authenticateToken, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = parseInt(req.params.id);
    
    if (isNaN(taskId)) {
      res.status(400).json({
        success: false,
        message: '无效的任务ID'
      });
      return;
    }

    const task = await TaskService.updateTaskStatus(taskId, true);
    
    if (!task) {
      res.status(404).json({
        success: false,
        message: '任务不存在'
      });
      return;
    }

    res.json({
      success: true,
      data: task,
      message: '任务已启用'
    });
  } catch (error: any) {
    console.error('启用任务错误:', error);
    res.status(500).json({
      success: false,
      message: '启用任务失败'
    });
  }
});

/**
 * 禁用任务
 * POST /api/tasks/:id/disable
 */
router.post('/:id/disable', authenticateToken, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = parseInt(req.params.id);
    
    if (isNaN(taskId)) {
      res.status(400).json({
        success: false,
        message: '无效的任务ID'
      });
      return;
    }

    const task = await TaskService.updateTaskStatus(taskId, false);
    
    if (!task) {
      res.status(404).json({
        success: false,
        message: '任务不存在'
      });
      return;
    }

    res.json({
      success: true,
      data: task,
      message: '任务已禁用'
    });
  } catch (error: any) {
    console.error('禁用任务错误:', error);
    res.status(500).json({
      success: false,
      message: '禁用任务失败'
    });
  }
});

/**
 * 手动触发任务
 * POST /api/tasks/:id/trigger
 */
router.post('/:id/trigger', authenticateToken, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = parseInt(req.params.id);
    
    if (isNaN(taskId)) {
      res.status(400).json({
        success: false,
        message: '无效的任务ID'
      });
      return;
    }

    await TaskService.triggerTask(taskId);

    res.json({
      success: true,
      message: '任务已触发'
    });
  } catch (error: any) {
    console.error('触发任务错误:', error);
    res.status(500).json({
      success: false,
      message: '触发任务失败'
    });
  }
});

export default router;
