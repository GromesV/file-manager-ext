"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatRelativeTime = formatRelativeTime;
exports.formatAbsoluteTime = formatAbsoluteTime;
exports.formatSize = formatSize;
/**
 * Format an ISO-8601 timestamp as a human-readable relative string.
 * e.g. "just now", "3 min ago", "2 hours ago", "5 days ago"
 */
function formatRelativeTime(isoString) {
    const then = new Date(isoString).getTime();
    const now = Date.now();
    const diffMs = now - then;
    if (diffMs < 0) {
        return "just now";
    }
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    if (seconds < 60) {
        return seconds <= 5 ? "just now" : `${seconds} sec ago`;
    }
    else if (minutes < 60) {
        return `${minutes} min ago`;
    }
    else if (hours < 24) {
        return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
    }
    else if (days < 7) {
        return days === 1 ? "yesterday" : `${days} days ago`;
    }
    else if (weeks < 5) {
        return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
    }
    else if (months < 12) {
        return months === 1 ? "1 month ago" : `${months} months ago`;
    }
    else {
        return years === 1 ? "1 year ago" : `${years} years ago`;
    }
}
/**
 * Format an ISO-8601 timestamp as a readable absolute date/time string.
 * e.g. "2024-01-15  14:32"
 */
function formatAbsoluteTime(isoString) {
    const d = new Date(isoString);
    const pad = (n) => String(n).padStart(2, "0");
    return (`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
        `  ${pad(d.getHours())}:${pad(d.getMinutes())}`);
}
/**
 * Human-readable file size.
 */
function formatSize(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    else if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    else {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
}
//# sourceMappingURL=utils.js.map