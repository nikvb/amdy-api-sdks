using System;

namespace Amdy.Client
{
    /// <summary>Base exception for AMDY API errors.</summary>
    public class AmdyException : Exception
    {
        /// <summary>HTTP status code returned by the API.</summary>
        public int StatusCode { get; }
        /// <summary>The raw response body.</summary>
        public string RawBody { get; }

        /// <summary>Creates the exception from the failed response.</summary>
        public AmdyException(int statusCode, string message, string rawBody)
            : base(message)
        {
            StatusCode = statusCode;
            RawBody = rawBody;
        }
    }

    /// <summary>Thrown when the API returns 401 (missing or invalid API key).</summary>
    public class AmdyAuthException : AmdyException
    {
        /// <summary>Creates a 401 exception from the failed response.</summary>
        public AmdyAuthException(string message, string rawBody)
            : base(401, message, rawBody)
        {
        }
    }

    /// <summary>Thrown when the API returns 404 (client not found for the given key).</summary>
    public class AmdyNotFoundException : AmdyException
    {
        /// <summary>Creates a 404 exception from the failed response.</summary>
        public AmdyNotFoundException(string message, string rawBody)
            : base(404, message, rawBody)
        {
        }
    }
}
