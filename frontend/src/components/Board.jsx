import { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { getTasks, updateTask } from '../api/client';
import TaskCard from './TaskCard';

const COLUMNS = ['BACKLOG', 'IN_PROGRESS', 'REVIEW', 'DONE'];
const COLUMN_LABELS = {
    BACKLOG: 'Backlog',
    IN_PROGRESS: 'In Progress',
    REVIEW: 'Review',
    DONE: 'Done'
};

export default function Board() {
    const [tasks, setTasks] = useState([]);
    const [error, setError] = useState(null);

    const loadTasks = () => {
        getTasks().then(setTasks).catch(() => setError('Could not load tasks'));
    };

    useEffect(() => {
        loadTasks();
    }, []);

    const onDragEnd = async (result) => {
        const { destination, draggableId } = result;
        if (!destination) return;

        const task = tasks.find(t => t.id === draggableId);
        if (task.blocked && destination.droppableId !== 'BACKLOG') {
            setError(`Cannot move "${task.title}": still waiting on ${task.blockedReason}`);
            return;
        }

        try {
            await updateTask(draggableId, { status: destination.droppableId });
            loadTasks();
        } catch (e) {
            setError('Failed to move task');
        }
    };

    if (error) {
        setTimeout(() => setError(null), 4000);
    }

    return (
        <div>
            {error && <div className="error-banner">{error}</div>}
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="board">
                    {COLUMNS.map(col => (
                        <Droppable droppableId={col} key={col}>
                            {(provided) => (
                                <div className="column" ref={provided.innerRef} {...provided.droppableProps}>
                                    <h3>{COLUMN_LABELS[col]}</h3>
                                    {tasks.filter(t => t.status === col).map((task, index) => (
                                        <Draggable draggableId={task.id} index={index} key={task.id}>
                                            {(provided) => (
                                                <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                                    <TaskCard task={task} />
                                                </div>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    ))}
                </div>
            </DragDropContext>
        </div>
    );
}