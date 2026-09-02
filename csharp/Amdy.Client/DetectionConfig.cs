using System;

namespace Amdy.Client
{
    /// <summary>Detection configuration for a client, as returned by GET /api/v1/config.</summary>
    public class DetectionConfig
    {
        /// <summary>The client this config belongs to.</summary>
        public long ClientId { get; set; }
        /// <summary>Detection sensitivity level (1-3).</summary>
        public int DetectionSensitivity { get; set; }
        /// <summary>Maximum detection window in milliseconds.</summary>
        public int MaxDetectionMs { get; set; }
        /// <summary>When the config was last updated, if known.</summary>
        public DateTimeOffset? UpdatedAt { get; set; }
    }
}
