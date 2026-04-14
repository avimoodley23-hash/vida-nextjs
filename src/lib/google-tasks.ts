import { google } from 'googleapis';

function getTasksClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.tasks({ version: 'v1', auth });
}

export interface GoogleTask {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
}

export async function getGoogleTasks(accessToken: string): Promise<GoogleTask[]> {
  const tasks = getTasksClient(accessToken);
  try {
    // Get default task list
    const lists = await tasks.tasklists.list({ maxResults: 1 });
    const listId = lists.data.items?.[0]?.id;
    if (!listId) return [];

    const res = await tasks.tasks.list({
      tasklist: listId,
      showCompleted: false,
      maxResults: 50,
    });

    return (res.data.items || []).map(t => ({
      id: t.id || '',
      title: t.title || '',
      notes: t.notes || undefined,
      status: (t.status as 'needsAction' | 'completed') || 'needsAction',
      due: t.due ? t.due.split('T')[0] : undefined,
    }));
  } catch (error) {
    console.error('Google Tasks fetch error:', error);
    return [];
  }
}

export async function createGoogleTask(
  accessToken: string,
  title: string,
  notes?: string,
  due?: string // YYYY-MM-DD
): Promise<{ success: boolean; id?: string }> {
  const tasks = getTasksClient(accessToken);
  try {
    const lists = await tasks.tasklists.list({ maxResults: 1 });
    const listId = lists.data.items?.[0]?.id;
    if (!listId) return { success: false };

    const res = await tasks.tasks.insert({
      tasklist: listId,
      requestBody: {
        title,
        notes,
        due: due ? `${due}T00:00:00.000Z` : undefined,
      },
    });
    return { success: true, id: res.data.id || undefined };
  } catch (error) {
    console.error('Google Tasks create error:', error);
    return { success: false };
  }
}

export async function completeGoogleTask(
  accessToken: string,
  taskId: string
): Promise<boolean> {
  const tasks = getTasksClient(accessToken);
  try {
    const lists = await tasks.tasklists.list({ maxResults: 1 });
    const listId = lists.data.items?.[0]?.id;
    if (!listId) return false;

    await tasks.tasks.patch({
      tasklist: listId,
      task: taskId,
      requestBody: { status: 'completed' },
    });
    return true;
  } catch (error) {
    console.error('Google Tasks complete error:', error);
    return false;
  }
}
