import React, { useEffect, useState } from 'react';

interface StatsItem {
    name: string;
    count: number;
    image: string;
    filter_value: string;
}

interface CategoryGridProps {
    type: 'directory' | 'actor' | 'genre' | 'series';
    libraryId: string;
    onSelect: (value: string, label: string) => void;
    fetchFn: (libId: string) => Promise<StatsItem[]>;
}

const CategoryGrid: React.FC<CategoryGridProps> = ({ type, libraryId, onSelect, fetchFn }) => {
    const [items, setItems] = useState<StatsItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetchFn(libraryId)
            .then(res => {
                setItems(res || []);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [libraryId, type]);

    if (loading) {
        return <div className="stats-loading">加载中...</div>;
    }

    const getLabelPrefix = () => {
        switch (type) {
            case 'directory': return '目录';
            case 'actor': return '演员群';
            case 'genre': return '类别';
            case 'series': return '系列';
            default: return '';
        }
    };

    return (
        <div className="stats-grid">
            {items.map((item, idx) => (
                <div 
                    key={idx} 
                    className="stats-card"
                    onClick={() => onSelect(item.filter_value, `${getLabelPrefix()}: ${item.name}`)}
                >
                    <div className="stats-card-image">
                        {item.image ? (
                            <img src={item.image} alt={item.name} onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=No+Image';
                            }} />
                        ) : (
                            <div className="stats-card-placeholder">
                                {type === 'directory' ? '📁' : type === 'actor' ? '👤' : type === 'genre' ? '🏷️' : '🎬'}
                            </div>
                        )}
                    </div>
                    <div className="stats-card-info">
                        <div className="stats-card-name" title={item.name}>{item.name}</div>
                        <div className="stats-card-count">{item.count} 个项目</div>
                    </div>
                </div>
            ))}
            {items.length === 0 && (
                <div className="stats-empty">暂无数据</div>
            )}
        </div>
    );
};

export default CategoryGrid;
