export default function TaskCard({ task }) {
    return (
        <div className="task-card">
            <p className="task-title">{task.title}</p>
            <p className="task-dates">{task.startDate} to {task.endDate}</p>
            {task.blocked ? (
                <span className="badge blocked">Blocked: waiting on {task.blockedReason}</span>
            ) : task.status === 'DONE' ? (
                <span className="badge done">Done</span>
            ) : (
                <span className="badge ready">Ready</span>
            )}
        </div>
    );
}